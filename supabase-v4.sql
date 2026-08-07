-- Athlete OS v4 migration. Run ONCE in Supabase SQL Editor (safe on existing database).

-- ===== Profile: bio, avatar, socials, streak =====
alter table profiles add column if not exists display_name text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists instagram_handle text;
alter table profiles add column if not exists other_social_url text;
alter table profiles add column if not exists best_streak integer default 0;
alter table profiles add column if not exists email text;

-- keep profiles.email synced with auth so friends can be found/displayed without exposing all of auth.users
update profiles p set email = u.email from auth.users u where p.id = u.id and (p.email is null or p.email = '');

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, weight_kg, height_cm, age, activity, surplus)
  values (new.id, new.email, 72, 180, 22, 1.8, 300)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user after insert on auth.users
  for each row execute function handle_new_user();

-- ===== Photo attachments on niggles and cricket technique notes =====
alter table niggle_entries add column if not exists photo_url text;
alter table cricket_entries add column if not exists photo_url text;

-- ===== Storage bucket for avatars and log photos (public read, owner-only write) =====
insert into storage.buckets (id, name, public)
values ('athlete-os-media', 'athlete-os-media', true)
on conflict (id) do nothing;

drop policy if exists "public read athlete-os-media" on storage.objects;
create policy "public read athlete-os-media" on storage.objects
  for select using (bucket_id = 'athlete-os-media');

drop policy if exists "own folder upload" on storage.objects;
create policy "own folder upload" on storage.objects
  for insert with check (bucket_id = 'athlete-os-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own folder update" on storage.objects;
create policy "own folder update" on storage.objects
  for update using (bucket_id = 'athlete-os-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own folder delete" on storage.objects;
create policy "own folder delete" on storage.objects
  for delete using (bucket_id = 'athlete-os-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===== Friends (mutual, request/accept) =====
create table if not exists friendships (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  friend_id uuid references auth.users(id) on delete cascade not null,
  status text default 'pending', -- pending | accepted
  created_at timestamptz default now(),
  unique (user_id, friend_id)
);

create or replace function are_friends(a uuid, b uuid) returns boolean as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((user_id = a and friend_id = b) or (user_id = b and friend_id = a))
  );
$$ language sql stable security definer;

alter table friendships enable row level security;
create policy "see own friendships" on friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "create friend request" on friendships for insert
  with check (auth.uid() = user_id);
create policy "accept friend request" on friendships for update
  using (auth.uid() = friend_id) with check (auth.uid() = friend_id);
create policy "remove own friendship" on friendships for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- ===== Activity feed — visible, moderatable "share with friends", not open private chat =====
create table if not exists feed_posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text default 'note', -- streak | match | pb | note
  content text not null,
  created_at timestamptz default now()
);
create table if not exists feed_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references feed_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);
create table if not exists feed_likes (
  post_id uuid references feed_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

alter table feed_posts enable row level security;
alter table feed_comments enable row level security;
alter table feed_likes enable row level security;

create policy "view own or friends posts" on feed_posts for select
  using (auth.uid() = user_id or are_friends(auth.uid(), user_id));
create policy "create own posts" on feed_posts for insert with check (auth.uid() = user_id);
create policy "delete own posts" on feed_posts for delete using (auth.uid() = user_id);

create policy "view comments on visible posts" on feed_comments for select
  using (exists (select 1 from feed_posts p where p.id = post_id and (p.user_id = auth.uid() or are_friends(auth.uid(), p.user_id))));
create policy "comment on visible posts" on feed_comments for insert
  with check (auth.uid() = user_id and exists (select 1 from feed_posts p where p.id = post_id and (p.user_id = auth.uid() or are_friends(auth.uid(), p.user_id))));
create policy "delete own comments" on feed_comments for delete using (auth.uid() = user_id);

create policy "view likes on visible posts" on feed_likes for select
  using (exists (select 1 from feed_posts p where p.id = post_id and (p.user_id = auth.uid() or are_friends(auth.uid(), p.user_id))));
create policy "like visible posts" on feed_likes for insert
  with check (auth.uid() = user_id and exists (select 1 from feed_posts p where p.id = post_id and (p.user_id = auth.uid() or are_friends(auth.uid(), p.user_id))));
create policy "unlike own likes" on feed_likes for delete using (auth.uid() = user_id);

-- ===== Push notification subscriptions =====
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, endpoint)
);
alter table push_subscriptions enable row level security;
create policy "own push subscriptions" on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== Safe friend lookup/listing (security definer so it can read auth.users / other profiles
--       narrowly, without opening up broad read access to everyone's profile row) =====
create or replace function find_user_id_by_email(lookup_email text)
returns uuid as $$
  select id from auth.users where lower(email) = lower(lookup_email) limit 1;
$$ language sql security definer stable;
revoke all on function find_user_id_by_email(text) from public;
grant execute on function find_user_id_by_email(text) to authenticated;

create or replace function get_my_friends()
returns table (
  friendship_id uuid, other_user_id uuid, email text, display_name text,
  avatar_url text, status text, i_am_requester boolean
) as $$
  select f.id, other_id,
    p.email, p.display_name, p.avatar_url, f.status,
    (f.user_id = auth.uid())
  from friendships f
  join lateral (select case when f.user_id = auth.uid() then f.friend_id else f.user_id end as other_id) x on true
  join profiles p on p.id = x.other_id
  where f.user_id = auth.uid() or f.friend_id = auth.uid();
$$ language sql security definer stable;
revoke all on function get_my_friends() from public;
grant execute on function get_my_friends() to authenticated;

-- ===== Feed with author info + like counts, respecting the same own-or-friends visibility as feed_posts RLS =====
create or replace function get_feed()
returns table (
  id uuid, user_id uuid, author_name text, author_avatar text, kind text,
  content text, created_at timestamptz, like_count bigint, liked_by_me boolean, comment_count bigint
) as $$
  select p.id, p.user_id, coalesce(pr.display_name, split_part(pr.email,'@',1)), pr.avatar_url,
    p.kind, p.content, p.created_at,
    (select count(*) from feed_likes l where l.post_id = p.id),
    exists(select 1 from feed_likes l2 where l2.post_id = p.id and l2.user_id = auth.uid()),
    (select count(*) from feed_comments c where c.post_id = p.id)
  from feed_posts p
  join profiles pr on pr.id = p.user_id
  where p.user_id = auth.uid() or are_friends(auth.uid(), p.user_id)
  order by p.created_at desc
  limit 100;
$$ language sql security definer stable;
revoke all on function get_feed() from public;
grant execute on function get_feed() to authenticated;

create or replace function get_feed_comments(p_post_id uuid)
returns table (id uuid, user_id uuid, author_name text, content text, created_at timestamptz) as $$
  select c.id, c.user_id, coalesce(pr.display_name, split_part(pr.email,'@',1)), c.content, c.created_at
  from feed_comments c
  join profiles pr on pr.id = c.user_id
  where c.post_id = p_post_id
  order by c.created_at asc;
$$ language sql security definer stable;
revoke all on function get_feed_comments(uuid) from public;
grant execute on function get_feed_comments(uuid) to authenticated;

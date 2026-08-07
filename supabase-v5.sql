-- Athlete OS v5 migration. Run ONCE in Supabase SQL Editor (safe on existing database).

-- ===== Username + optional phone (display-only, not verified) =====
alter table profiles add column if not exists username text unique;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists is_coach boolean default false;

-- ===== Referral / points infrastructure =====
-- NOTE: this tracks invites and awards points, but there is no real paid-subscription system wired up yet.
-- Points are a ledger you can redeem manually for now (e.g. you personally comp someone's month) until
-- billing exists — see the app's README for what's needed before this can auto-grant real subscription time.
alter table profiles add column if not exists referral_code text unique;
alter table profiles add column if not exists referred_by uuid references auth.users(id);
alter table profiles add column if not exists points integer default 0;

create table if not exists referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_id uuid references auth.users(id) on delete cascade not null,
  referred_id uuid references auth.users(id) on delete cascade not null,
  awarded boolean default false,
  created_at timestamptz default now(),
  unique (referred_id)
);
alter table referrals enable row level security;
create policy "see own referrals" on referrals for select using (auth.uid() = referrer_id);

-- give everyone a referral code (short, readable) — backfill existing users, and set new ones going forward
create or replace function gen_referral_code() returns text as $$
  select upper(substr(md5(random()::text), 1, 6));
$$ language sql volatile;

update profiles set referral_code = gen_referral_code() where referral_code is null;

-- extend the signup trigger to also set a referral code and capture who referred them (see handle_new_user below)
create or replace function handle_new_user()
returns trigger as $$
declare
  ref_code text;
  referrer uuid;
begin
  ref_code := gen_referral_code();
  -- if the client passed ?ref=CODE through to signup metadata, look up who owns that code
  if new.raw_user_meta_data ->> 'referred_by_code' is not null then
    select id into referrer from profiles where referral_code = upper(new.raw_user_meta_data ->> 'referred_by_code') limit 1;
  end if;

  insert into public.profiles (id, email, weight_kg, height_cm, age, activity, surplus, referral_code, referred_by)
  values (new.id, new.email, 72, 180, 22, 1.8, 300, ref_code, referrer)
  on conflict (id) do update set email = excluded.email;

  if referrer is not null then
    insert into referrals (referrer_id, referred_id) values (referrer, new.id) on conflict do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- award the referrer points once the referred player actually completes onboarding (not just signs up)
create or replace function award_referral_on_onboard()
returns trigger as $$
begin
  if new.onboarded = true and (old.onboarded is distinct from true) then
    update referrals set awarded = true
      where referred_id = new.id and awarded = false;
    update profiles set points = points + 50
      where id = (select referrer_id from referrals where referred_id = new.id and awarded = true);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_award_referral on profiles;
create trigger trg_award_referral after update on profiles
  for each row execute function award_referral_on_onboard();

-- extend the friends list RPC (defined in v4) to also return username now that it exists
drop function if exists get_my_friends();
create or replace function get_my_friends()
returns table (
  friendship_id uuid, other_user_id uuid, email text, username text, display_name text,
  avatar_url text, status text, i_am_requester boolean
) as $$
  select f.id, other_id,
    p.email, p.username, p.display_name, p.avatar_url, f.status,
    (f.user_id = auth.uid())
  from friendships f
  join lateral (select case when f.user_id = auth.uid() then f.friend_id else f.user_id end as other_id) x on true
  join profiles p on p.id = x.other_id
  where f.user_id = auth.uid() or f.friend_id = auth.uid();
$$ language sql security definer stable;

-- ===== Safe user search (username prefix match, or exact email/phone match — never broad free-text over PII) =====
create or replace function search_users(query text)
returns table (id uuid, username text, display_name text, avatar_url text) as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from profiles p
  where p.id != auth.uid() and (
    (p.username is not null and p.username ilike query || '%') or
    lower(p.email) = lower(query) or
    (p.phone is not null and p.phone = query)
  )
  limit 10;
$$ language sql security definer stable;
revoke all on function search_users(text) from public;
grant execute on function search_users(text) to authenticated;

-- ===== Coach video tips on the feed =====
alter table feed_posts add column if not exists media_url text;
alter table feed_posts add column if not exists media_type text; -- 'image' | 'video' | null

drop function if exists get_feed();
create or replace function get_feed()
returns table (
  id uuid, user_id uuid, author_name text, author_avatar text, author_is_coach boolean, kind text,
  content text, media_url text, media_type text, created_at timestamptz,
  like_count bigint, liked_by_me boolean, comment_count bigint
) as $$
  select p.id, p.user_id, coalesce(pr.display_name, split_part(pr.email,'@',1)), pr.avatar_url, coalesce(pr.is_coach, false),
    p.kind, p.content, p.media_url, p.media_type, p.created_at,
    (select count(*) from feed_likes l where l.post_id = p.id),
    exists(select 1 from feed_likes l2 where l2.post_id = p.id and l2.user_id = auth.uid()),
    (select count(*) from feed_comments c where c.post_id = p.id)
  from feed_posts p
  join profiles pr on pr.id = p.user_id
  where p.user_id = auth.uid() or are_friends(auth.uid(), p.user_id)
  order by p.created_at desc
  limit 100;
$$ language sql security definer stable;

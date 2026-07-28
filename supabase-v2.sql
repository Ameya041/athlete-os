-- Athlete OS v2 migration. Run ONCE in Supabase SQL Editor (safe to run on existing v1 database).

-- === day_logs: new recovery / load columns ===
alter table day_logs add column if not exists session_rpe integer;
alter table day_logs add column if not exists session_minutes integer;
alter table day_logs add column if not exists sleep_hours numeric;
alter table day_logs add column if not exists sleep_quality integer;
alter table day_logs add column if not exists readiness integer;
alter table day_logs add column if not exists meditation_minutes integer default 0;
alter table day_logs add column if not exists meditation_type text;

-- === custom training programs ===
create table if not exists programs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  weeks integer default 4,
  created_at timestamptz default now()
);

create table if not exists program_days (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid references programs(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  day_of_week integer not null, -- 0=Sunday .. 6=Saturday
  title text not null,
  subtitle text,
  day_type text default 'strength', -- strength | power | conditioning | recovery | rest
  created_at timestamptz default now()
);

create table if not exists program_exercises (
  id uuid primary key default uuid_generate_v4(),
  program_day_id uuid references program_days(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  target text,
  sort integer default 0,
  created_at timestamptz default now()
);

alter table profiles add column if not exists active_program_id uuid references programs(id) on delete set null;
alter table profiles add column if not exists onboarded boolean default false;

-- === niggle / pain tracking ===
create table if not exists niggle_entries (
  id uuid primary key default uuid_generate_v4(),
  day_log_id uuid references day_logs(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  body_area text not null,
  severity integer, -- 1-10
  description text,
  worse_after text, -- bowling | batting | lifting | fielding | rest | other
  source text default 'manual',
  created_at timestamptz default now()
);

-- === match scorecards ===
create table if not exists match_entries (
  id uuid primary key default uuid_generate_v4(),
  day_log_id uuid references day_logs(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  opponent text,
  format text, -- T20 | 50-over | 2-day | 3-day | other
  runs integer,
  balls integer,
  dismissal text,
  overs_bowled numeric,
  maidens integer,
  runs_conceded integer,
  wickets integer,
  catches integer,
  conditions text,
  notes text,
  source text default 'manual',
  created_at timestamptz default now()
);

-- === user_id auto-fill triggers ===
create trigger trg_niggle_user_id before insert on niggle_entries
  for each row execute function set_user_id_from_day_log();
create trigger trg_match_user_id before insert on match_entries
  for each row execute function set_user_id_from_day_log();

create or replace function set_user_id_from_program_day()
returns trigger as $$
begin
  select user_id into new.user_id from program_days where id = new.program_day_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace function set_user_id_from_program()
returns trigger as $$
begin
  select user_id into new.user_id from programs where id = new.program_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_program_day_user_id before insert on program_days
  for each row execute function set_user_id_from_program();
create trigger trg_program_ex_user_id before insert on program_exercises
  for each row execute function set_user_id_from_program_day();

-- === Row Level Security ===
alter table programs enable row level security;
alter table program_days enable row level security;
alter table program_exercises enable row level security;
alter table niggle_entries enable row level security;
alter table match_entries enable row level security;

create policy "own programs" on programs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own program days" on program_days for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own program exercises" on program_exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own niggles" on niggle_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own matches" on match_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

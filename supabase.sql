-- Run this entire file once in Supabase: Dashboard > SQL Editor > New query > paste > Run

create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  weight_kg numeric default 72,
  height_cm numeric default 180,
  age integer default 22,
  activity numeric default 1.8,
  surplus numeric default 300,
  -- one of: batsman_top, batsman_middle, fast_bowler, spinner_off, spinner_leg,
  -- spinner_left_arm, wicket_keeper, all_rounder
  player_role text default 'all_rounder',
  templates_seeded boolean default false,
  created_at timestamptz default now()
);

create table if not exists day_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null,
  morning_weight_kg numeric,
  prehab_done boolean default false,
  meditation_done boolean default false,
  created_at timestamptz default now(),
  unique (user_id, log_date)
);

create table if not exists workout_entries (
  id uuid primary key default uuid_generate_v4(),
  day_log_id uuid references day_logs(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  exercise text not null,
  sets_reps text,
  weight_kg numeric,
  notes text,
  source text default 'manual',
  created_at timestamptz default now()
);

create table if not exists food_entries (
  id uuid primary key default uuid_generate_v4(),
  day_log_id uuid references day_logs(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  item text not null,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  source text default 'manual',
  created_at timestamptz default now()
);

create table if not exists cricket_entries (
  id uuid primary key default uuid_generate_v4(),
  day_log_id uuid references day_logs(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  session_type text,
  batting_notes text,
  bowling_notes text,
  fielding_notes text,
  rating integer,
  improvement_focus text,
  fatigue_level integer,
  -- role-specific numbers live here, e.g. {"middlingPct":70,"shotExecutionPct":55}
  -- or {"oversBowled":8,"effortBalls":12,"lineLengthControlPct":60,"stiffness":6}
  -- or {"catches":2,"stumpings":0,"byes":3,"footworkRating":7}
  role_metrics jsonb default '{}'::jsonb,
  gate_flagged boolean default false,
  gate_reason text,
  source text default 'manual',
  created_at timestamptz default now()
);

-- Editable weekly S&C program: one row per day of week per user, with its own line items.
-- Seeded with sensible defaults on first login, then fully user-editable — nothing hardcoded per player.
create table if not exists workout_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Sunday ... 6=Saturday
  title text not null,
  subtitle text,
  session_type text default 'strength', -- strength | power | conditioning | recovery | rest
  core_circuit boolean default false,
  unique (user_id, day_of_week)
);

create table if not exists template_items (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid references workout_templates(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  item_type text default 'exercise', -- exercise | block
  name text not null,
  target text,
  sort_order integer default 0
);

create table if not exists mindset_entries (
  id uuid primary key default uuid_generate_v4(),
  day_log_id uuid references day_logs(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade,
  mood integer,
  confidence integer,
  pressure integer,
  notes text,
  insight text,
  source text default 'manual',
  created_at timestamptz default now()
);

-- Auto-fill user_id on child tables from the parent day_log, so the client never has to send it
create or replace function set_user_id_from_day_log()
returns trigger as $$
begin
  select user_id into new.user_id from day_logs where id = new.day_log_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_workout_user_id before insert on workout_entries
  for each row execute function set_user_id_from_day_log();
create trigger trg_food_user_id before insert on food_entries
  for each row execute function set_user_id_from_day_log();
create trigger trg_cricket_user_id before insert on cricket_entries
  for each row execute function set_user_id_from_day_log();
create trigger trg_mindset_user_id before insert on mindset_entries
  for each row execute function set_user_id_from_day_log();

create or replace function set_user_id_from_template()
returns trigger as $$
begin
  select user_id into new.user_id from workout_templates where id = new.template_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_template_item_user_id before insert on template_items
  for each row execute function set_user_id_from_template();

-- Row Level Security: every user can only ever read/write their own rows
alter table profiles enable row level security;
alter table day_logs enable row level security;
alter table workout_entries enable row level security;
alter table food_entries enable row level security;
alter table cricket_entries enable row level security;
alter table mindset_entries enable row level security;
alter table workout_templates enable row level security;
alter table template_items enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own days" on day_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workouts" on workout_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own food" on food_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own cricket" on cricket_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own mindset" on mindset_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own templates" on workout_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own template items" on template_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Athlete OS v3 migration. Run ONCE in Supabase SQL Editor (safe on existing v1/v2 database).

alter table profiles add column if not exists experience_years numeric;
alter table profiles add column if not exists squat_est_1rm numeric;
alter table profiles add column if not exists deadlift_est_1rm numeric;
alter table profiles add column if not exists bench_est_1rm numeric;
alter table profiles add column if not exists aerobic_note text; -- free text: e.g. "2km in 8:30" or "Yo-Yo 18.5"
alter table profiles add column if not exists injury_history text;
alter table profiles add column if not exists primary_role text; -- batter | bowler | all-rounder | wicketkeeper
alter table profiles add column if not exists assessment_done boolean default false;
alter table profiles add column if not exists seen_help_tour boolean default false;

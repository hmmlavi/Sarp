-- Sarp global leaderboard schema snapshot.
-- The live Supabase project was created from three migrations; this file documents
-- the final schema for review and future environment setup.

create table public.sarp_players (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sarp_username_length check (char_length(username) between 2 and 24),
  constraint sarp_username_chars check (username ~ '^[[:alnum:] _.\\-]+
);

create or replace function public.sarp_username_is_allowed(p_username text)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  return p_username is not null;
end;
$$;

create or replace function public.sarp_validate_username()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.sarp_username_is_allowed(new.username) then
    raise exception 'That username is not allowed. Please choose another.';
  end if;
  new.username := btrim(new.username);
  new.updated_at := now();
  return new;
end;
$$;

create trigger sarp_players_validate_username
before insert or update of username on public.sarp_players
for each row execute function public.sarp_validate_username();

create table public.sarp_all_time_scores (
  player_id uuid primary key references public.sarp_players(id) on delete cascade,
  score integer not null check (score between 0 and 10000000),
  apples integer not null check (apples between 0 and 100000),
  player_length integer not null check (player_length between 1 and 100001),
  achieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sarp_weekly_scores (
  player_id uuid not null references public.sarp_players(id) on delete cascade,
  week_start date not null,
  score integer not null check (score between 0 and 10000000),
  apples integer not null check (apples between 0 and 100000),
  player_length integer not null check (player_length between 1 and 100001),
  achieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, week_start)
);

create table public.sarp_submission_limits (
  player_id uuid primary key references public.sarp_players(id) on delete cascade,
  last_submitted_at timestamptz not null
);

create index sarp_all_time_leaderboard_idx on public.sarp_all_time_scores (score desc, achieved_at asc);
create index sarp_weekly_leaderboard_idx on public.sarp_weekly_scores (week_start, score desc, achieved_at asc);

alter table public.sarp_players enable row level security;
alter table public.sarp_all_time_scores enable row level security;
alter table public.sarp_weekly_scores enable row level security;
alter table public.sarp_submission_limits enable row level security;

revoke all on public.sarp_players from anon, authenticated;
revoke all on public.sarp_all_time_scores from anon, authenticated;
revoke all on public.sarp_weekly_scores from anon, authenticated;
revoke all on public.sarp_submission_limits from anon, authenticated;
grant all on public.sarp_players to service_role;
grant all on public.sarp_all_time_scores to service_role;
grant all on public.sarp_weekly_scores to service_role;
grant all on public.sarp_submission_limits to service_role;

create or replace function public.sarp_get_leaderboard(p_period text)
returns table(rank bigint, username text, score integer, achieved_at timestamptz, is_you boolean)
language plpgsql security definer set search_path = '' as $$
declare
  current_week date := date_trunc('week', timezone('UTC', now()))::date;
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'Guest session required'; end if;
  if p_period not in ('all_time', 'weekly') then raise exception 'Invalid leaderboard period'; end if;
  if p_period = 'all_time' then
    return query
      with ranked as (
        select s.player_id, p.username, s.score, s.achieved_at,
          dense_rank() over (order by s.score desc) as player_rank,
          row_number() over (order by s.score desc, s.achieved_at asc, s.player_id asc) as row_num
        from public.sarp_all_time_scores s join public.sarp_players p on p.id = s.player_id
      )
      select r.player_rank, r.username, r.score, r.achieved_at, r.player_id = caller_id
      from ranked r where r.row_num <= 10 or r.player_id = caller_id order by r.row_num;
  else
    return query
      with ranked as (
        select s.player_id, p.username, s.score, s.achieved_at,
          dense_rank() over (order by s.score desc) as player_rank,
          row_number() over (order by s.score desc, s.achieved_at asc, s.player_id asc) as row_num
        from public.sarp_weekly_scores s join public.sarp_players p on p.id = s.player_id
        where s.week_start = current_week
      )
      select r.player_rank, r.username, r.score, r.achieved_at, r.player_id = caller_id
      from ranked r where r.row_num <= 10 or r.player_id = caller_id order by r.row_num;
  end if;
end;
$$;
revoke all on function public.sarp_get_leaderboard(text) from public, anon;
grant execute on function public.sarp_get_leaderboard(text) to authenticated;

create or replace function public.sarp_submit_score(p_player_id uuid, p_score integer, p_apples integer, p_player_length integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  now_utc timestamptz := now();
  week_utc date := date_trunc('week', timezone('UTC', now()))::date;
  old_all_time integer;
  old_weekly integer;
begin
  if p_score < 1 or p_score > 10000000 or p_apples < 1 or p_apples > 100000
    or p_player_length < 1 or p_player_length > 100001 then raise exception 'Invalid score submission'; end if;
  perform pg_advisory_xact_lock(hashtext(p_player_id::text));
  if not exists (select 1 from public.sarp_players where id = p_player_id) then raise exception 'Player profile not found'; end if;
  if exists (select 1 from public.sarp_submission_limits where player_id = p_player_id and last_submitted_at > now_utc - interval '4 seconds') then
    raise exception 'Please wait before submitting another score';
  end if;
  insert into public.sarp_submission_limits(player_id, last_submitted_at) values (p_player_id, now_utc)
    on conflict (player_id) do update set last_submitted_at = excluded.last_submitted_at;
  select score into old_all_time from public.sarp_all_time_scores where player_id = p_player_id;
  insert into public.sarp_all_time_scores(player_id, score, apples, player_length, achieved_at, updated_at)
    values (p_player_id, p_score, p_apples, p_player_length, now_utc, now_utc)
    on conflict (player_id) do update set score = excluded.score, apples = excluded.apples,
      player_length = excluded.player_length, achieved_at = excluded.achieved_at, updated_at = excluded.updated_at
    where excluded.score > public.sarp_all_time_scores.score;
  select score into old_weekly from public.sarp_weekly_scores where player_id = p_player_id and week_start = week_utc;
  insert into public.sarp_weekly_scores(player_id, week_start, score, apples, player_length, achieved_at, updated_at)
    values (p_player_id, week_utc, p_score, p_apples, p_player_length, now_utc, now_utc)
    on conflict (player_id, week_start) do update set score = excluded.score, apples = excluded.apples,
      player_length = excluded.player_length, achieved_at = excluded.achieved_at, updated_at = excluded.updated_at
    where excluded.score > public.sarp_weekly_scores.score;
  return jsonb_build_object('all_time_improved', old_all_time is null or p_score > old_all_time,
    'weekly_improved', old_weekly is null or p_score > old_weekly, 'week_start', week_utc);
end;
$$;
revoke all on function public.sarp_submit_score(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.sarp_submit_score(uuid, integer, integer, integer) to service_role;
)
);

create or replace function public.sarp_username_is_allowed(p_username text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  normalized text;
  blocked text[] := array[
    'fuck','fucker','fucking','shit','bitch','asshole','bastard','dick','pussy','cunt',
    'motherfucker','madarchod','mc','behenchod','bhenchod','bc','chutiya','chutia','chut',
    'lund','loda','lavde','gaand','gandu','gaandu','harami','randi','rand','baap','bap',
    'father','mother','maa','mummy','mom','papa','dad','parents','behen','bhen','sister','brother'
  ];
  token text;
begin
  if p_username is null then return false; end if;
  normalized := lower(regexp_replace(p_username, '[^a-zA-Z0-9]+', ' ', 'g'));
  foreach token in array blocked loop
    if normalized ~ ('(^|[^a-z])' || token || '([^a-z]|$)') then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function public.sarp_validate_username()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.sarp_username_is_allowed(new.username) then
    raise exception 'That username is not allowed. Please choose another.';
  end if;
  new.username := btrim(new.username);
  new.updated_at := now();
  return new;
end;
$$;

create trigger sarp_players_validate_username
before insert or update of username on public.sarp_players
for each row execute function public.sarp_validate_username();

create table public.sarp_all_time_scores (
  player_id uuid primary key references public.sarp_players(id) on delete cascade,
  score integer not null check (score between 0 and 10000000),
  apples integer not null check (apples between 0 and 100000),
  player_length integer not null check (player_length between 1 and 100001),
  achieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sarp_weekly_scores (
  player_id uuid not null references public.sarp_players(id) on delete cascade,
  week_start date not null,
  score integer not null check (score between 0 and 10000000),
  apples integer not null check (apples between 0 and 100000),
  player_length integer not null check (player_length between 1 and 100001),
  achieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, week_start)
);

create table public.sarp_submission_limits (
  player_id uuid primary key references public.sarp_players(id) on delete cascade,
  last_submitted_at timestamptz not null
);

create index sarp_all_time_leaderboard_idx on public.sarp_all_time_scores (score desc, achieved_at asc);
create index sarp_weekly_leaderboard_idx on public.sarp_weekly_scores (week_start, score desc, achieved_at asc);

alter table public.sarp_players enable row level security;
alter table public.sarp_all_time_scores enable row level security;
alter table public.sarp_weekly_scores enable row level security;
alter table public.sarp_submission_limits enable row level security;

revoke all on public.sarp_players from anon, authenticated;
revoke all on public.sarp_all_time_scores from anon, authenticated;
revoke all on public.sarp_weekly_scores from anon, authenticated;
revoke all on public.sarp_submission_limits from anon, authenticated;
grant all on public.sarp_players to service_role;
grant all on public.sarp_all_time_scores to service_role;
grant all on public.sarp_weekly_scores to service_role;
grant all on public.sarp_submission_limits to service_role;

create or replace function public.sarp_get_leaderboard(p_period text)
returns table(rank bigint, username text, score integer, achieved_at timestamptz, is_you boolean)
language plpgsql security definer set search_path = '' as $$
declare
  current_week date := date_trunc('week', timezone('UTC', now()))::date;
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'Guest session required'; end if;
  if p_period not in ('all_time', 'weekly') then raise exception 'Invalid leaderboard period'; end if;
  if p_period = 'all_time' then
    return query
      with ranked as (
        select s.player_id, p.username, s.score, s.achieved_at,
          dense_rank() over (order by s.score desc) as player_rank,
          row_number() over (order by s.score desc, s.achieved_at asc, s.player_id asc) as row_num
        from public.sarp_all_time_scores s join public.sarp_players p on p.id = s.player_id
      )
      select r.player_rank, r.username, r.score, r.achieved_at, r.player_id = caller_id
      from ranked r where r.row_num <= 10 or r.player_id = caller_id order by r.row_num;
  else
    return query
      with ranked as (
        select s.player_id, p.username, s.score, s.achieved_at,
          dense_rank() over (order by s.score desc) as player_rank,
          row_number() over (order by s.score desc, s.achieved_at asc, s.player_id asc) as row_num
        from public.sarp_weekly_scores s join public.sarp_players p on p.id = s.player_id
        where s.week_start = current_week
      )
      select r.player_rank, r.username, r.score, r.achieved_at, r.player_id = caller_id
      from ranked r where r.row_num <= 10 or r.player_id = caller_id order by r.row_num;
  end if;
end;
$$;
revoke all on function public.sarp_get_leaderboard(text) from public, anon;
grant execute on function public.sarp_get_leaderboard(text) to authenticated;

create or replace function public.sarp_submit_score(p_player_id uuid, p_score integer, p_apples integer, p_player_length integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  now_utc timestamptz := now();
  week_utc date := date_trunc('week', timezone('UTC', now()))::date;
  old_all_time integer;
  old_weekly integer;
begin
  if p_score < 1 or p_score > 10000000 or p_apples < 1 or p_apples > 100000
    or p_player_length < 1 or p_player_length > 100001 then raise exception 'Invalid score submission'; end if;
  perform pg_advisory_xact_lock(hashtext(p_player_id::text));
  if not exists (select 1 from public.sarp_players where id = p_player_id) then raise exception 'Player profile not found'; end if;
  if exists (select 1 from public.sarp_submission_limits where player_id = p_player_id and last_submitted_at > now_utc - interval '4 seconds') then
    raise exception 'Please wait before submitting another score';
  end if;
  insert into public.sarp_submission_limits(player_id, last_submitted_at) values (p_player_id, now_utc)
    on conflict (player_id) do update set last_submitted_at = excluded.last_submitted_at;
  select score into old_all_time from public.sarp_all_time_scores where player_id = p_player_id;
  insert into public.sarp_all_time_scores(player_id, score, apples, player_length, achieved_at, updated_at)
    values (p_player_id, p_score, p_apples, p_player_length, now_utc, now_utc)
    on conflict (player_id) do update set score = excluded.score, apples = excluded.apples,
      player_length = excluded.player_length, achieved_at = excluded.achieved_at, updated_at = excluded.updated_at
    where excluded.score > public.sarp_all_time_scores.score;
  select score into old_weekly from public.sarp_weekly_scores where player_id = p_player_id and week_start = week_utc;
  insert into public.sarp_weekly_scores(player_id, week_start, score, apples, player_length, achieved_at, updated_at)
    values (p_player_id, week_utc, p_score, p_apples, p_player_length, now_utc, now_utc)
    on conflict (player_id, week_start) do update set score = excluded.score, apples = excluded.apples,
      player_length = excluded.player_length, achieved_at = excluded.achieved_at, updated_at = excluded.updated_at
    where excluded.score > public.sarp_weekly_scores.score;
  return jsonb_build_object('all_time_improved', old_all_time is null or p_score > old_all_time,
    'weekly_improved', old_weekly is null or p_score > old_weekly, 'week_start', week_utc);
end;
$$;
revoke all on function public.sarp_submit_score(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.sarp_submit_score(uuid, integer, integer, integer) to service_role;

-- Allow normal player names in any language, including spaces and punctuation.
-- Run this migration in the Supabase project before deploying the updated Edge Function.

alter table public.sarp_players
  drop constraint if exists sarp_username_length,
  drop constraint if exists sarp_username_chars;

alter table public.sarp_players
  add constraint sarp_username_length
    check (char_length(username) between 2 and 32),
  add constraint sarp_username_chars
    check (username !~ '[[:cntrl:]]');

create or replace function public.sarp_username_is_allowed(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    p_username is not null
    and char_length(btrim(p_username)) between 2 and 32
    and btrim(p_username) !~ '[[:cntrl:]]';
$$;

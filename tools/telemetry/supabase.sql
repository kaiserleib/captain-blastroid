-- Captain Blastroid milestone counts (see src/meta/telemetry.ts).
-- Run once in the Supabase SQL editor. The game calls blastroid_count() through
-- PostgREST with the project's publishable key; it can add one to a daily total and
-- nothing else. No row describes a player or an install.

create table if not exists public.blastroid_events (
  day date not null default ((now() at time zone 'utc')::date),
  event text not null,
  platform text not null,
  version text not null,
  n bigint not null default 0,
  primary key (day, event, platform, version)
);

-- No policies: the table is closed to the API. Only the function below writes to it.
alter table public.blastroid_events enable row level security;

create or replace function public.blastroid_count(event text, platform text, version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Anything unexpected is dropped quietly, so junk can't add rows.
  if blastroid_count.event !~ '^(first_open|act1_clear|(offer_seen|pack_get|pack_play)_[a-z0-9]{1,16})$'
     or blastroid_count.platform not in ('ios', 'android', 'web')
     or blastroid_count.version !~ '^[0-9]{1,3}(\.[0-9]{1,3}){0,2}$' then
    return;
  end if;
  insert into public.blastroid_events as e (event, platform, version, n)
  values (blastroid_count.event, blastroid_count.platform, blastroid_count.version, 1)
  -- By constraint name: the column names would clash with the arguments.
  on conflict on constraint blastroid_events_pkey do update set n = e.n + 1;
end;
$$;

revoke all on function public.blastroid_count(text, text, text) from public;
grant execute on function public.blastroid_count(text, text, text) to anon;

-- Reading the numbers (SQL editor):
--
--   select platform, event, sum(n) as installs
--   from public.blastroid_events
--   group by platform, event
--   order by platform, event;
--
-- Share of players who finished Act I and took the expansion:
--
--   select platform,
--          sum(n) filter (where event = 'pack_get_act2')::numeric
--            / nullif(sum(n) filter (where event = 'act1_clear'), 0) as claim_rate
--   from public.blastroid_events
--   group by platform;

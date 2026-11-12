-- Notifications page and push notifications (phone and laptop, when Taske is added as an app or open in a browser).
-- Run once in the Supabase SQL Editor (safe to re-run).

-- What shows on the Notifications page. "overdue" rows are made by the server every 15 minutes;
-- "test" rows when someone turns notifications on for a device.
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('overdue', 'test')),
  task_id     uuid references public.tasks (id) on delete cascade,
  -- For "overdue": the deadline that was missed. A task moved to a new deadline and missed again notifies again.
  deadline    date,
  title       text not null check (char_length(title) between 1 and 300),
  body        text not null default '' check (char_length(body) <= 1000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
-- One "overdue" notification per task and missed deadline.
create unique index if not exists notifications_overdue_once on public.notifications (task_id, deadline) where kind = 'overdue';

alter table public.notifications enable row level security;
drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

-- Devices that receive push notifications: one row per browser / home-screen app.
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique check (endpoint like 'https://%'),
  p256dh      text not null,
  auth        text not null,
  -- The device's time zone, so "overdue" starts at the user's own midnight and pushes wait until 09:00 there.
  time_zone   text not null default 'Asia/Tbilisi',
  user_agent  text not null default '',
  created_at  timestamptz not null default now(),
  -- Last time the test notification arrived on this device.
  verified_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Saves this device for the signed-in user. A browser keeps the same endpoint across accounts,
-- so an endpoint that belonged to someone else (sign out, sign in as another person) moves over.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_time_zone text, p_user_agent text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, time_zone, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth,
          -- An unknown zone name would break the overdue job for everyone, so only real ones are kept.
          case when exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then p_time_zone else 'Asia/Tbilisi' end,
          left(coalesce(p_user_agent, ''), 300))
  on conflict (endpoint) do update set
    user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    time_zone = excluded.time_zone, user_agent = excluded.user_agent,
    -- Same device and keys, same person: keep the test result. Anything else must be tested again.
    verified_at = case when public.push_subscriptions.user_id = excluded.user_id
                        and public.push_subscriptions.p256dh = excluded.p256dh then public.push_subscriptions.verified_at end;
end $$;
revoke all on function public.save_push_subscription(text, text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, text) to authenticated;

-- Called by the server's 15-minute job (service role only). Adds one "overdue" notification for every
-- open task whose deadline has passed in the user's time zone, once it is 09:00 or later there,
-- and returns only the rows it just added (so each push goes out once).
create or replace function public.queue_overdue_notifications()
returns setof public.notifications language sql security definer set search_path = '' as $$
  with zones as (
    select u.id as user_id,
           coalesce((select s.time_zone from public.push_subscriptions s
                     where s.user_id = u.id order by s.created_at desc limit 1), 'Asia/Tbilisi') as tz
    from auth.users u
  ), due as (
    select t.id, t.user_id, t.title, t.deadline
    from public.tasks t
    join zones z on z.user_id = t.user_id
    where t.deadline is not null
      and t.status in ('todo', 'doing')
      and t.title <> ''
      and t.deadline < (now() at time zone z.tz)::date
      and extract(hour from (now() at time zone z.tz)) >= 9
  )
  insert into public.notifications (user_id, kind, task_id, deadline, title, body)
  select d.user_id, 'overdue', d.id, d.deadline, left('Overdue: ' || d.title, 300),
         'The deadline was ' || trim(to_char(d.deadline, 'FMDay, FMMonth FMDD')) || '.'
  from due d
  on conflict (task_id, deadline) where kind = 'overdue' do nothing
  returning *;
$$;
revoke all on function public.queue_overdue_notifications() from public, anon, authenticated;
grant execute on function public.queue_overdue_notifications() to service_role;

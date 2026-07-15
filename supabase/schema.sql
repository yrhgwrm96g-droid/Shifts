-- Shift Swap — database schema (username + password version)
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run
-- If you ran an older version of this schema before, first run:
--   drop table if exists availability, swap_requests, shifts, users cascade;

create table users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  name text,
  role text not null default 'user' check (role in ('user','admin')),
  must_change_password boolean not null default true,
  created_at timestamptz default now()
);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'normal' check (status in ('normal','offered','swapped')),
  created_at timestamptz default now()
);
create index shifts_user_date on shifts(user_id, date);
create index shifts_status on shifts(status);

create table swap_requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts(id) on delete cascade,
  from_user uuid not null references users(id) on delete cascade,
  to_user uuid references users(id),
  type text not null check (type in ('giveaway','swap')),
  offered_shift_id uuid references shifts(id),
  note text,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz default now(),
  resolved_at timestamptz
);
create index swap_requests_status on swap_requests(status);

create table availability (
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  preference text not null check (preference in ('want_to_work','prefer_off')),
  primary key (user_id, date)
);

-- First admin account.
-- Username: admin   Temporary password: ChangeMe123!
-- You will be forced to change it on first login.
insert into users (username, password_hash, name, role) values (
  'admin',
  '$2a$10$ud7oOhSOiEnKiSy6LmLxTeYCCX49CDT/m8xGmTNpvunwx0kvcGd86',
  'Administrator',
  'admin'
);

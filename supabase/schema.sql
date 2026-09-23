-- ABA Desk — Supabase schema
-- Idempotent: paste the whole file into the Supabase SQL Editor and click Run, the first time
-- or again to pick up new changes.
--
-- Multi-user from day one: every row belongs to the signed-in user (owner_id = auth.uid()),
-- and Row Level Security makes each person see ONLY their own data. That is what lets the same
-- app be offered to other BCBAs later without them seeing each other's clients or earnings.
--
-- Privacy: this app is a personal work organizer, not an EHR. Keep client data to the minimum
-- (initials or first name, authorization dates). Do not store diagnoses or clinical notes.

create table if not exists profiles (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null default '',
  credential text not null default 'BCBA',
  certification_date date,
  language text not null default 'en',
  show_full_names boolean not null default false,
  tax_rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  clinical_rate numeric not null default 0,
  admin_rate numeric not null default 0,
  pay_schedule text not null default 'biweekly',
  color text not null default '#7C83D6',
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  company_id uuid references companies(id) on delete set null,
  auth_start date,
  auth_end date,
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists hour_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  kind text not null default 'clinical',
  hours numeric not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists hour_entries_owner_date_idx on hour_entries(owner_id, date);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pay_date date not null,
  expected numeric not null default 0,
  received numeric not null default 0,
  received_date date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

-- Supervision (phase 3): RBTs and BCBA fieldwork trainees the user supervises.
create table if not exists supervisees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'rbt',
  fieldwork_type text not null default 'supervised',
  company_id uuid references companies(id) on delete set null,
  client_ids uuid[] not null default '{}',
  rate numeric not null default 0,
  start_date date,
  contract_date date,
  color text not null default '#7C83D6',
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Supervision meetings, past or scheduled (a future date = an upcoming meeting).
create table if not exists supervision_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  supervisee_id uuid not null references supervisees(id) on delete cascade,
  date date not null,
  hours numeric not null,
  format text not null default 'individual',
  with_client boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists supervision_sessions_owner_date_idx on supervision_sessions(owner_id, date);

-- Hours the supervisee worked (RBT) or accrued in fieldwork, one row per calendar month.
create table if not exists supervisee_months (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  supervisee_id uuid not null references supervisees(id) on delete cascade,
  month text not null,
  hours numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (supervisee_id, month)
);

-- Row Level Security: each user reads and writes only their own rows.
alter table profiles enable row level security;
alter table companies enable row level security;
alter table clients enable row level security;
alter table hour_entries enable row level security;
alter table payments enable row level security;
alter table todos enable row level security;
alter table supervisees enable row level security;
alter table supervision_sessions enable row level security;
alter table supervisee_months enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['companies', 'clients', 'hour_entries', 'payments', 'todos', 'supervisees', 'supervision_sessions', 'supervisee_months'] loop
    execute format('drop policy if exists "own rows" on %I', t);
    execute format(
      'create policy "own rows" on %I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      t
    );
  end loop;
end $$;

# Supabase Setup (Multi-user)

## 1. Environment variables
Create `.env` from `.env.example` and fill in your project values.

## 2. Enable GitHub auth
In Supabase dashboard:
- Authentication -> Providers -> GitHub -> Enable
- Add your app callback URL(s)

## 3. Create workspace table
Run this SQL in Supabase SQL editor:

```sql
-- Create workspaces table
create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"folders":[],"charts":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.workspaces enable row level security;

-- Drop existing policies if they exist
drop policy if exists "workspace_select_own" on public.workspaces;
drop policy if exists "workspace_insert_own" on public.workspaces;
drop policy if exists "workspace_update_own" on public.workspaces;

-- Create policies
create policy "workspace_select_own"
on public.workspaces
for select
using (auth.uid() = user_id);

create policy "workspace_insert_own"
on public.workspaces
for insert
with check (auth.uid() = user_id);

create policy "workspace_update_own"
on public.workspaces
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## 4. Deploy
Deploy frontend (Vercel/Netlify), add env vars there, and use HTTPS domain in Supabase redirect URLs.

-- ============================================
-- YARNZOO MOSAIC STUDIO - COMPLETE DATABASE SCHEMA
-- ============================================

-- 1. WORKSPACES TABLE (already created, but included for completeness)
create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"folders":[],"charts":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. CHARTS TABLE - Individual saved patterns
create table if not exists public.charts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  chart_data jsonb not null,
  grid_width int not null,
  grid_height int not null,
  color_a jsonb not null default '{"name":"Zandvoort","hex":"#E8DCC8"}'::jsonb,
  color_b jsonb not null default '{"name":"Arnhem","hex":"#C75050"}'::jsonb,
  config jsonb not null default '{"direction":"RtoL","showEdges":true}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. SHARED_CHARTS TABLE - Track which charts are shared and with whom
create table if not exists public.shared_charts (
  id uuid primary key default gen_random_uuid(),
  chart_id uuid not null references public.charts(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  shared_with uuid references auth.users(id) on delete cascade, -- NULL means public share
  share_token text unique, -- For sharing via link
  created_at timestamptz not null default now()
);

-- 4. FOLDERS TABLE - Organize charts
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#F5921B',
  created_at timestamptz not null default now()
);

-- 5. CHART_FOLDERS - Many-to-many relationship
create table if not exists public.chart_folders (
  chart_id uuid not null references public.charts(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  primary key (chart_id, folder_id)
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- WORKSPACES RLS
alter table public.workspaces enable row level security;

drop policy if exists "workspace_select_own" on public.workspaces;
drop policy if exists "workspace_insert_own" on public.workspaces;
drop policy if exists "workspace_update_own" on public.workspaces;

create policy "workspace_select_own" on public.workspaces
  for select using (auth.uid() = user_id);

create policy "workspace_insert_own" on public.workspaces
  for insert with check (auth.uid() = user_id);

create policy "workspace_update_own" on public.workspaces
  for update using (auth.uid() = user_id);

-- CHARTS RLS
alter table public.charts enable row level security;

drop policy if exists "charts_select_own_or_shared" on public.charts;
drop policy if exists "charts_insert_own" on public.charts;
drop policy if exists "charts_update_own" on public.charts;
drop policy if exists "charts_delete_own" on public.charts;

create policy "charts_select_own_or_shared" on public.charts
  for select using (
    auth.uid() = user_id OR 
    is_public = true OR
    id in (
      select chart_id from public.shared_charts 
      where shared_with = auth.uid() or shared_with is null
    )
  );

create policy "charts_insert_own" on public.charts
  for insert with check (auth.uid() = user_id);

create policy "charts_update_own" on public.charts
  for update using (auth.uid() = user_id);

create policy "charts_delete_own" on public.charts
  for delete using (auth.uid() = user_id);

-- SHARED_CHARTS RLS
alter table public.shared_charts enable row level security;

drop policy if exists "shared_charts_select" on public.shared_charts;
drop policy if exists "shared_charts_insert_own" on public.shared_charts;
drop policy if exists "shared_charts_delete_own" on public.shared_charts;

create policy "shared_charts_select" on public.shared_charts
  for select using (
    auth.uid() = shared_by OR 
    auth.uid() = shared_with OR
    shared_with is null
  );

create policy "shared_charts_insert_own" on public.shared_charts
  for insert with check (auth.uid() = shared_by);

create policy "shared_charts_delete_own" on public.shared_charts
  for delete using (auth.uid() = shared_by);

-- FOLDERS RLS
alter table public.folders enable row level security;

drop policy if exists "folders_all_own" on public.folders;

create policy "folders_all_own" on public.folders
  for all using (auth.uid() = user_id);

-- CHART_FOLDERS RLS
alter table public.chart_folders enable row level security;

drop policy if exists "chart_folders_select" on public.chart_folders;
drop policy if exists "chart_folders_insert_own" on public.chart_folders;
drop policy if exists "chart_folders_delete_own" on public.chart_folders;

create policy "chart_folders_select" on public.chart_folders
  for select using (
    exists (
      select 1 from public.charts 
      where id = chart_id and user_id = auth.uid()
    )
  );

create policy "chart_folders_insert_own" on public.chart_folders
  for insert with check (
    exists (
      select 1 from public.charts 
      where id = chart_id and user_id = auth.uid()
    )
  );

create policy "chart_folders_delete_own" on public.chart_folders
  for delete using (
    exists (
      select 1 from public.charts 
      where id = chart_id and user_id = auth.uid()
    )
  );

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

create index if not exists idx_charts_user_id on public.charts(user_id);
create index if not exists idx_charts_is_public on public.charts(is_public);
create index if not exists idx_shared_charts_chart_id on public.shared_charts(chart_id);
create index if not exists idx_shared_charts_shared_with on public.shared_charts(shared_with);
create index if not exists idx_folders_user_id on public.folders(user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for auto-updating updated_at
drop trigger if exists update_workspaces_updated_at on public.workspaces;
create trigger update_workspaces_updated_at
  before update on public.workspaces
  for each row execute function update_updated_at_column();

drop trigger if exists update_charts_updated_at on public.charts;
create trigger update_charts_updated_at
  before update on public.charts
  for each row execute function update_updated_at_column();

-- ============================================
-- GLOBAL APP TRANSLATIONS (shared for all users)
-- ============================================

create table if not exists public.app_translations (
  id text primary key,
  texts jsonb not null,
  locked boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.app_translations enable row level security;

drop policy if exists "app_translations_select_all" on public.app_translations;
drop policy if exists "app_translations_write_authenticated" on public.app_translations;

create policy "app_translations_select_all" on public.app_translations
  for select using (true);

create policy "app_translations_write_authenticated" on public.app_translations
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create index if not exists idx_app_translations_updated_at on public.app_translations(updated_at);

drop trigger if exists update_app_translations_updated_at on public.app_translations;
create trigger update_app_translations_updated_at
  before update on public.app_translations
  for each row execute function update_updated_at_column();

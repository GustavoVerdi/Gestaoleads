create table if not exists public.workspace_projects (
  id text primary key,
  workspace_key text not null default 'verdi-tech-solucoes',
  created_by uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_leads (
  id text primary key,
  workspace_key text not null default 'verdi-tech-solucoes',
  created_by uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workspace_projects enable row level security;
alter table public.workspace_leads enable row level security;

create index if not exists workspace_projects_updated_at_idx on public.workspace_projects (updated_at desc);
create index if not exists workspace_leads_updated_at_idx on public.workspace_leads (updated_at desc);

comment on table public.workspace_projects is 'Projetos persistidos do painel Verdi Tech.';
comment on table public.workspace_leads is 'Leads persistidos do painel Verdi Tech.';

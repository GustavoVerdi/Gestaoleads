-- Base inicial de identidade e cargos do Verdi Tech Gestão.
-- Não guarda senhas: autenticação e credenciais ficam sob responsabilidade do Supabase Auth.
create table if not exists public.app_roles (
  id text primary key,
  name text not null unique,
  permissions text[] not null default '{}',
  protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role_id text not null default 'sales' references public.app_roles(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_roles (id, name, permissions, protected) values
  ('owner', 'Dono', array['dashboard','projects','leads','project-edit','sensitive','team'], true),
  ('sales', 'Vendedor', array['dashboard','projects','leads'], false)
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role_id)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'sales')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.app_roles enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Authenticated users can read roles" on public.app_roles;
create policy "Authenticated users can read roles"
  on public.app_roles for select to authenticated using (true);

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated using ((select auth.uid()) = id);

grant usage on schema public to authenticated;
grant select on public.app_roles, public.profiles to authenticated;

comment on table public.profiles is 'Perfil associado ao usuário autenticado; novos usuários começam como vendedor.';
comment on table public.app_roles is 'Cargos e permissões iniciais da aplicação.';

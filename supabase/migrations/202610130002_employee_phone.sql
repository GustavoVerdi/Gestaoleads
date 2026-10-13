update public.app_roles
set name = 'CEO', permissions = array['dashboard','projects','leads','project-edit','sensitive','team'], protected = true, updated_at = now()
where id = 'owner';

insert into public.app_roles (id, name, permissions, protected)
values ('manager', 'Gerente', array['dashboard','projects','leads','project-edit'], false)
on conflict (id) do update set name = excluded.name, permissions = excluded.permissions, updated_at = now();

alter table public.profiles
  add column if not exists phone text not null default '';

comment on column public.profiles.phone is 'Telefone profissional do funcionário.';

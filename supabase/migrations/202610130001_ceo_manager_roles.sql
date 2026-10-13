-- Mantém o ID owner para preservar perfis e permissões existentes.
-- Não atribui novos acessos a funcionários já cadastrados.
begin;
update public.app_roles set name = 'CEO', updated_at = now() where id = 'owner';
insert into public.app_roles (id, name, permissions, protected)
values ('manager', 'Gerente', array['dashboard','projects','leads','project-edit'], false)
on conflict (id) do nothing;
commit;

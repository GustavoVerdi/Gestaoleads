-- Novas contas começam com acesso apenas após confirmarem o e-mail e definirem sua senha.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- Contas existentes que não são Dono também definem uma senha própria no próximo acesso.
update public.profiles
set must_change_password = true
where role_id <> 'owner' and must_change_password = false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role_id, must_change_password)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'sales', true)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists "Users can finish their own first password setup" on public.profiles;
create policy "Users can finish their own first password setup"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id and must_change_password)
  with check ((select auth.uid()) = id and not must_change_password);

grant update (must_change_password) on public.profiles to authenticated;

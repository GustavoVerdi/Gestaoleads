-- Promove o usuário administrativo principal da Verdi Tech para CEO.
-- A senha continua sendo gerenciada exclusivamente pelo Supabase Auth.
update public.profiles as profile
set role_id = 'owner',
    updated_at = now()
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = lower('gustavoverdi2015@gmail.com');

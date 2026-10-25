-- Supabase's optional automatic-RLS event trigger is an administrative helper.
-- It does not need to be callable by REST clients. The event trigger stays on.
begin;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
commit;
select proname,
 has_function_privilege('anon',oid,'execute') as anon_can_execute,
 has_function_privilege('authenticated',oid,'execute') as signed_in_can_execute
from pg_proc where oid='public.rls_auto_enable()'::regprocedure;

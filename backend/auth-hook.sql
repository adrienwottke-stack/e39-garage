-- Enable this function as the "Before User Created" Auth Hook afterward.
begin;
grant usage on schema public to supabase_auth_admin;
grant select on public.e39_members to supabase_auth_admin;
create policy "Auth checks the private admission list" on public.e39_members
 for select to supabase_auth_admin using (true);
create function public.e39_before_user_created(event jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
 if not exists(select 1 from public.e39_members where email=lower(event->'user'->>'email')) then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Diese E39-Garage ist privat. Dieses Konto ist nicht freigeschaltet.'));
 end if;
 return '{}'::jsonb;
end;
$$;
revoke all on function public.e39_before_user_created(jsonb) from public,anon,authenticated;
grant execute on function public.e39_before_user_created(jsonb) to supabase_auth_admin;
commit;

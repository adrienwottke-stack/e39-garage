-- Additive format upgrade. Existing version-1 rows stay valid and are upgraded
-- in the client. Once a row is version 2, old clients must not erase its looks.
begin;
alter table public.e39_garages drop constraint e39_valid_state;
alter table public.e39_garages add constraint e39_valid_state check (coalesce(
 jsonb_typeof(state)='object' and state->>'version' in ('1','2','3')
 and (state->>'version'='1' or (jsonb_typeof(state->'studio')='object' and jsonb_typeof(state->'studio'->'drafts')='array'))
 and jsonb_typeof(state->'profile')='object'
 and jsonb_typeof(state->'readings')='array'
 and jsonb_typeof(state->'entries')='array'
 and jsonb_typeof(state->'tasks')='array'
 and jsonb_typeof(state->'parts')='array'
 and jsonb_typeof(state->'documents')='array'
 and octet_length(state::text)<=2097152
 ,false));
create or replace function public.e39_commit(expected_revision bigint,next_state jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare saved_revision bigint;
begin
 if auth.uid() is null or not exists(select 1 from public.e39_members m where m.email=lower(auth.jwt()->>'email')) then
  raise exception 'E39_FORBIDDEN';
 end if;
 if expected_revision < 0 or expected_revision is null then raise exception 'E39_INVALID_REVISION'; end if;
 if exists(select 1 from public.e39_garages where owner_id=auth.uid() and ((state->>'version'='3' and next_state->>'version' in ('1','2')) or (state->>'version'='2' and next_state->>'version'='1'))) then
  raise exception 'E39_UPGRADE_REQUIRED';
 end if;
 if expected_revision=0 then
  insert into public.e39_garages(owner_id,revision,state) values(auth.uid(),1,jsonb_set(next_state,'{revision}','1'::jsonb))
  on conflict(owner_id) do nothing returning revision into saved_revision;
 else
  update public.e39_garages set state=jsonb_set(next_state,'{revision}',to_jsonb(expected_revision+1)),revision=expected_revision+1,updated_at=now()
  where owner_id=auth.uid() and revision=expected_revision returning revision into saved_revision;
 end if;
 if saved_revision is null then raise exception 'E39_CONFLICT'; end if;
 return saved_revision;
end;
$$;
revoke all on function public.e39_commit(bigint,jsonb) from public,anon;
grant execute on function public.e39_commit(bigint,jsonb) to authenticated;
commit;
select 'E39 tuning format 3 enabled' as result;

-- Synthetic owner and data only; every change is rolled back.
begin;
insert into auth.users(id,email,aud,role) values ('43900000-0000-4000-8000-000000000003','e39-studio@example.invalid','authenticated','authenticated');
insert into public.e39_members(email) values ('e39-studio@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"43900000-0000-4000-8000-000000000003","email":"e39-studio@example.invalid","role":"authenticated"}',true);
do $$
declare legacy jsonb := '{"version":1,"profile":{},"readings":[],"entries":[],"tasks":[],"parts":[],"documents":[]}';
 modern jsonb; revision_result bigint;
begin
 modern := jsonb_set(legacy,'{version}','2') || '{"studio":{"baseline":null,"baselineConfirmed":false,"drafts":[{"id":"A","name":"SYNTHETIC"}]}}';
 revision_result := public.e39_commit(0,legacy);
 if revision_result<>1 then raise exception 'FAIL: legacy row rejected'; end if;
 revision_result := public.e39_commit(1,modern);
 if revision_result<>2 then raise exception 'FAIL: upgraded row rejected'; end if;
 begin
  perform public.e39_commit(2,legacy);
  raise exception 'FAIL: old client erased new looks';
 exception when raise_exception then
  if sqlerrm<>'E39_UPGRADE_REQUIRED' then raise; end if;
 end;
 if not exists(select 1 from public.e39_garages g where g.owner_id=auth.uid() and g.state->'studio'->'drafts'->0->>'name'='SYNTHETIC' and g.revision=2) then
  raise exception 'FAIL: design did not persist after blocked downgrade';
 end if;
 begin
  perform public.e39_commit(1,modern);
  raise exception 'FAIL: stale design write accepted';
 exception when raise_exception then
  if sqlerrm<>'E39_CONFLICT' then raise; end if;
 end;
end $$;
reset role;
rollback;
select 'PASS: legacy support, v2 design commit, downgrade protection, persistence, stale write rejection; fixtures rolled back' as result;

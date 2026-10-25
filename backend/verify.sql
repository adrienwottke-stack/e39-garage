-- Synthetic authorization test. Every fixture is rolled back.
begin;
insert into auth.users (id,email,aud,role) values
 ('43900000-0000-4000-8000-000000000001','e39-test-a@example.invalid','authenticated','authenticated'),
 ('43900000-0000-4000-8000-000000000002','e39-test-b@example.invalid','authenticated','authenticated');
insert into public.e39_members(email) values ('e39-test-a@example.invalid'),('e39-test-b@example.invalid');
insert into public.e39_garages(owner_id,revision,state) values ('43900000-0000-4000-8000-000000000002',1,
 '{"version":1,"profile":{},"readings":[],"entries":[],"tasks":[],"parts":[],"documents":[]}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"43900000-0000-4000-8000-000000000001","email":"e39-test-a@example.invalid","role":"authenticated"}',true);
do $$
declare count_rows integer; rev bigint; state jsonb := '{"version":1,"profile":{},"readings":[],"entries":[],"tasks":[],"parts":[],"documents":[]}';
begin
 select count(*) into count_rows from public.e39_garages;
 if count_rows <> 0 then raise exception 'FAIL: another garage is readable'; end if;
 rev := public.e39_commit(0,state);
 if rev <> 1 then raise exception 'FAIL: first commit'; end if;
 rev := public.e39_commit(1,state);
 if rev <> 2 then raise exception 'FAIL: update commit'; end if;
 begin
  perform public.e39_commit(1,state);
  raise exception 'FAIL: stale write accepted';
 exception when raise_exception then
  if sqlerrm <> 'E39_CONFLICT' then raise; end if;
 end;
 begin
  insert into public.e39_garages(owner_id,revision,state) values ('43900000-0000-4000-8000-000000000002',1,state);
  raise exception 'FAIL: other-owner insert accepted';
 exception when insufficient_privilege then null;
 end;
 update public.e39_garages g set state=jsonb_set(g.state,'{bad}', 'true') where owner_id='43900000-0000-4000-8000-000000000002';
 get diagnostics count_rows=row_count;
 if count_rows <> 0 then raise exception 'FAIL: other-owner update'; end if;
 begin
  insert into public.e39_members(email) values ('uninvited@example.invalid');
  raise exception 'FAIL: self-enrollment accepted';
 exception when insufficient_privilege then null;
 end;
 insert into storage.objects(bucket_id,name) values ('e39-documents','43900000-0000-4000-8000-000000000001/test.pdf');
 begin
  insert into storage.objects(bucket_id,name) values ('e39-documents','43900000-0000-4000-8000-000000000002/test.pdf');
  raise exception 'FAIL: upload into another owner folder';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claims','{"sub":"43900000-0000-4000-8000-000000000001","email":"uninvited@example.invalid","role":"authenticated"}',true);
 select count(*) into count_rows from public.e39_garages;
 if count_rows <> 0 then raise exception 'FAIL: uninvited account can read'; end if;
 begin
  perform public.e39_commit(2,state);
  raise exception 'FAIL: uninvited commit accepted';
 exception when raise_exception then
  if sqlerrm <> 'E39_FORBIDDEN' then raise; end if;
 end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform * from public.e39_garages;
  raise exception 'FAIL: anonymous select';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.e39_commit(0,'{}');
  raise exception 'FAIL: anonymous commit';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
select 'PASS: owner CRUD, isolation, stale-write rejection, no self-enrollment, private storage, anon denied. Test fixtures rolled back.' as result;

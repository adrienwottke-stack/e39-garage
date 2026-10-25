-- E39 Garage: isolated personal project. Apply once in its SQL editor.
-- No existing project is referenced. Owner access is activated separately.
begin;
create table public.e39_members (
 email text primary key check (email = lower(email)),
 created_at timestamptz not null default now()
);
alter table public.e39_members enable row level security;
revoke all on public.e39_members from anon, authenticated;
grant select on public.e39_members to authenticated;
create policy "Members can see their own admission" on public.e39_members
 for select to authenticated using (email = lower((select auth.jwt())->>'email'));

create table public.e39_garages (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 1 check (revision > 0),
 state jsonb not null,
 updated_at timestamptz not null default now(),
 constraint e39_valid_state check (coalesce(
  jsonb_typeof(state) = 'object' and state->>'version' in ('1','2','3')
  and (state->>'version'='1' or (jsonb_typeof(state->'studio')='object' and jsonb_typeof(state->'studio'->'drafts')='array'))
  and jsonb_typeof(state->'profile') = 'object'
  and jsonb_typeof(state->'readings') = 'array'
  and jsonb_typeof(state->'entries') = 'array'
  and jsonb_typeof(state->'tasks') = 'array'
  and jsonb_typeof(state->'parts') = 'array'
  and jsonb_typeof(state->'documents') = 'array'
  and octet_length(state::text) <= 2097152
 ,false))
);
alter table public.e39_garages enable row level security;
revoke all on public.e39_garages from anon, authenticated;
grant select, insert, update on public.e39_garages to authenticated;
create policy "Owner can read their garage" on public.e39_garages
 for select to authenticated using (
  owner_id = (select auth.uid()) and exists(select 1 from public.e39_members m where m.email=lower((select auth.jwt())->>'email'))
 );
create policy "Owner can create their garage" on public.e39_garages
 for insert to authenticated with check (
  owner_id = (select auth.uid()) and exists(select 1 from public.e39_members m where m.email=lower((select auth.jwt())->>'email'))
 );
create policy "Owner can update their garage" on public.e39_garages
 for update to authenticated using (
  owner_id = (select auth.uid()) and exists(select 1 from public.e39_members m where m.email=lower((select auth.jwt())->>'email'))
 ) with check (
  owner_id = (select auth.uid()) and exists(select 1 from public.e39_members m where m.email=lower((select auth.jwt())->>'email'))
 );

create function public.e39_commit(expected_revision bigint, next_state jsonb)
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
 if expected_revision = 0 then
  insert into public.e39_garages(owner_id,revision,state) values
   (auth.uid(),1,jsonb_set(next_state,'{revision}','1'::jsonb))
   on conflict (owner_id) do nothing returning revision into saved_revision;
 else
  update public.e39_garages set state=jsonb_set(next_state,'{revision}',to_jsonb(expected_revision+1)),
   revision=expected_revision+1,updated_at=now()
  where owner_id=auth.uid() and revision=expected_revision returning revision into saved_revision;
 end if;
 if saved_revision is null then raise exception 'E39_CONFLICT'; end if;
 return saved_revision;
end;
$$;
revoke all on function public.e39_commit(bigint,jsonb) from public,anon;
grant execute on function public.e39_commit(bigint,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('e39-documents','e39-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy "Owner can read garage documents" on storage.objects
 for select to authenticated using (bucket_id='e39-documents' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.e39_members m where m.email=lower((select auth.jwt())->>'email')));
create policy "Owner can upload garage documents" on storage.objects
 for insert to authenticated with check (bucket_id='e39-documents' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.e39_members m where m.email=lower((select auth.jwt())->>'email')));
create policy "Owner can remove garage documents" on storage.objects
 for delete to authenticated using (bucket_id='e39-documents' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.e39_members m where m.email=lower((select auth.jwt())->>'email')));
commit;

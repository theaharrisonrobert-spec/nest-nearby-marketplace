-- Verification fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN id_type text,
  ADD COLUMN id_number text,
  ADD COLUMN id_document_path text,
  ADD COLUMN verified_at timestamptz;

-- Roles
create type public.app_role as enum ('admin', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Admins can read and update all profiles (to review and approve verifications)
create policy "Admins read all profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins update profiles" on public.profiles for update to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Admin notifications (signup / signin / verification requests)
create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  kind text not null,
  message text not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.admin_notifications to authenticated;
grant all on public.admin_notifications to service_role;
alter table public.admin_notifications enable row level security;
create policy "Admins read notifications" on public.admin_notifications for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Signed-in users create notifications" on public.admin_notifications for insert to authenticated with check (true);

-- Notify admin on every new signup (profile creation)
create or replace function public.notify_new_signup() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (user_id, kind, message)
  values (new.id, 'signup', 'New signup: ' || coalesce(new.full_name, 'Unnamed user'));
  return new;
end $$;
create trigger on_profile_created after insert on public.profiles for each row execute function public.notify_new_signup();

-- Only approved users can post listings
drop policy "owner insert" on public.listings;
create policy "owner insert" on public.listings for insert to authenticated with check (
  auth.uid() = owner_id
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.verification_status = 'approved')
);

-- ID document storage (private bucket 'id-documents')
create policy "Users upload own ID docs" on storage.objects for insert to authenticated with check (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users read own ID docs" on storage.objects for select to authenticated using (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Admins read ID docs" on storage.objects for select to authenticated using (bucket_id = 'id-documents' and public.has_role(auth.uid(), 'admin'));
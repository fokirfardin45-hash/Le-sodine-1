-- Le Sodine cloud setup for Supabase. Run the entire file in Supabase Dashboard > SQL Editor.
-- Then replace fokirfardin45@example.com below with the staff login email before running.
create extension if not exists pgcrypto;

create table if not exists public.staff_emails (
  email text primary key check (email = lower(email))
);
-- Replace this value with your own staff email, then run this INSERT separately if needed:
insert into public.staff_emails(email) values ('fokirfardin45@gmail.com') on conflict do nothing;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff_emails
    where email = lower(coalesce(auth.jwt()->>'email',''))
  );
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  description text not null default '',
  image_url text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_settings (
  id integer primary key check (id = 1),
  delivery_fee numeric(10,2) not null default 4.90 check (delivery_fee >= 0),
  free_delivery_threshold numeric(10,2) not null default 50 check (free_delivery_threshold >= 0),
  updated_at timestamptz not null default now()
);
insert into public.shop_settings(id) values (1) on conflict do nothing;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  customer_email text not null,
  phone text not null,
  postal_code text not null,
  city text not null,
  province text not null,
  address text not null,
  notes text not null default '',
  payment_method text not null,
  items jsonb not null,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  delivery_fee numeric(10,2) not null check (delivery_fee >= 0),
  total numeric(10,2) not null check (total >= 0),
  status text not null default 'Ricevuto',
  created_at timestamptz not null default now()
);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);

alter table public.staff_emails enable row level security;
alter table public.products enable row level security;
alter table public.shop_settings enable row level security;
alter table public.orders enable row level security;

drop policy if exists "active products are public" on public.products;
create policy "active products are public" on public.products for select to anon, authenticated using (active or public.is_staff());
drop policy if exists "staff manage products" on public.products;
create policy "staff manage products" on public.products for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "shop settings are public" on public.shop_settings;
create policy "shop settings are public" on public.shop_settings for select to anon, authenticated using (true);
drop policy if exists "staff manage settings" on public.shop_settings;
create policy "staff manage settings" on public.shop_settings for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "customers see own orders or staff see all" on public.orders;
create policy "customers see own orders or staff see all" on public.orders for select to authenticated using (auth.uid() = user_id or public.is_staff());
drop policy if exists "customers create own orders" on public.orders;
create policy "customers create own orders" on public.orders for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "staff update orders" on public.orders;
create policy "staff update orders" on public.orders for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff delete orders" on public.orders;
create policy "staff delete orders" on public.orders for delete to authenticated using (public.is_staff());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=8388608,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "public can view product images" on storage.objects;
create policy "public can view product images" on storage.objects for select to anon,authenticated using (bucket_id='product-images');
drop policy if exists "staff upload product images" on storage.objects;
create policy "staff upload product images" on storage.objects for insert to authenticated with check (bucket_id='product-images' and public.is_staff());
drop policy if exists "staff update product images" on storage.objects;
create policy "staff update product images" on storage.objects for update to authenticated using (bucket_id='product-images' and public.is_staff()) with check (bucket_id='product-images' and public.is_staff());
drop policy if exists "staff delete product images" on storage.objects;
create policy "staff delete product images" on storage.objects for delete to authenticated using (bucket_id='product-images' and public.is_staff());

-- Enable realtime for online menu/settings/order changes.
do $$ begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.shop_settings;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; when others then null; end $$;

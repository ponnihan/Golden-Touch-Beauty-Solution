-- GOLDEN TOUCH FULL MANAGEMENT SYSTEM
-- Run this complete script in the SQL Editor of project loyzzvrflfhndfnnppgf.
create extension if not exists pgcrypto;

-- Core tables (existing data is preserved)
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), name text not null, category text,
 description text, price numeric(12,2) not null default 0 check(price>=0),
 stock integer not null default 0 check(stock>=0), image_url text,
 is_active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(), customer_name text not null,
 phone text not null, address text not null, items jsonb not null default '[]'::jsonb,
 total numeric(12,2) not null default 0 check(total>=0), payment_method text not null default 'COD',
 transaction_id text, status text not null default 'pending', created_at timestamptz not null default now()
);
create table if not exists public.bookings (
 id uuid primary key default gen_random_uuid(), customer_name text not null,
 phone text not null, service text not null, booking_date date not null,
 booking_time text, notes text, status text not null default 'pending', created_at timestamptz not null default now()
);
create table if not exists public.categories (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 created_at timestamptz not null default now()
);
create table if not exists public.services (
 id uuid primary key default gen_random_uuid(), name text not null,
 category text, description text, price numeric(12,2) not null default 0 check(price>=0),
 duration_minutes integer not null default 0, is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.store_settings (
 key text primary key, value text not null default '', updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.bookings enable row level security;
alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.store_settings enable row level security;

-- Remove/recreate named policies to make this script safe to rerun.
drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products" on public.products for select to anon, authenticated using (is_active=true);
drop policy if exists "Admin manages products" on public.products;
create policy "Admin manages products" on public.products for all to authenticated using ((auth.jwt()->>'email')='ponni171196@gmail.com') with check ((auth.jwt()->>'email')='ponni171196@gmail.com');

drop policy if exists "Public can submit orders" on public.orders;
create policy "Public can submit orders" on public.orders for insert to anon, authenticated with check (true);
drop policy if exists "Admin manages orders" on public.orders;
create policy "Admin manages orders" on public.orders for all to authenticated using ((auth.jwt()->>'email')='ponni171196@gmail.com') with check ((auth.jwt()->>'email')='ponni171196@gmail.com');

drop policy if exists "Public can submit bookings" on public.bookings;
create policy "Public can submit bookings" on public.bookings for insert to anon, authenticated with check (true);
drop policy if exists "Admin manages bookings" on public.bookings;
create policy "Admin manages bookings" on public.bookings for all to authenticated using ((auth.jwt()->>'email')='ponni171196@gmail.com') with check ((auth.jwt()->>'email')='ponni171196@gmail.com');

drop policy if exists "Public can view active services" on public.services;
create policy "Public can view active services" on public.services for select to anon, authenticated using (is_active=true);
drop policy if exists "Admin manages services" on public.services;
create policy "Admin manages services" on public.services for all to authenticated using ((auth.jwt()->>'email')='ponni171196@gmail.com') with check ((auth.jwt()->>'email')='ponni171196@gmail.com');

drop policy if exists "Admin manages categories" on public.categories;
create policy "Admin manages categories" on public.categories for all to authenticated using ((auth.jwt()->>'email')='ponni171196@gmail.com') with check ((auth.jwt()->>'email')='ponni171196@gmail.com');
drop policy if exists "Admin manages store settings" on public.store_settings;
create policy "Admin manages store settings" on public.store_settings for all to authenticated using ((auth.jwt()->>'email')='ponni171196@gmail.com') with check ((auth.jwt()->>'email')='ponni171196@gmail.com');

grant usage on schema public to anon, authenticated;
grant select on public.products, public.services to anon, authenticated;
grant insert on public.orders, public.bookings to anon, authenticated;
grant all privileges on public.products, public.orders, public.bookings, public.categories, public.services, public.store_settings to authenticated;

-- Product image bucket: public reads; authenticated admin uploads/updates/deletes.
insert into storage.buckets (id,name,public) values ('product-images','product-images',true)
on conflict (id) do update set public=true;
drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images" on storage.objects for select to anon, authenticated using (bucket_id='product-images');
drop policy if exists "Admin upload product images" on storage.objects;
create policy "Admin upload product images" on storage.objects for insert to authenticated with check (bucket_id='product-images' and (auth.jwt()->>'email')='ponni171196@gmail.com');
drop policy if exists "Admin update product images" on storage.objects;
create policy "Admin update product images" on storage.objects for update to authenticated using (bucket_id='product-images' and (auth.jwt()->>'email')='ponni171196@gmail.com') with check (bucket_id='product-images' and (auth.jwt()->>'email')='ponni171196@gmail.com');
drop policy if exists "Admin delete product images" on storage.objects;
create policy "Admin delete product images" on storage.objects for delete to authenticated using (bucket_id='product-images' and (auth.jwt()->>'email')='ponni171196@gmail.com');

insert into public.store_settings(key,value) values
 ('business_name','Golden Touch'),('phone','01990941408'),('whatsapp','8801990941408'),('delivery_charge','0'),('currency','BDT')
on conflict (key) do nothing;

notify pgrst, 'reload schema';

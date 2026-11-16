create table public.studio_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  category text not null check (category in ('Women', 'Men', 'Materials', 'Other')),
  variant text not null check (char_length(btrim(variant)) between 1 and 40),
  quantity integer not null check (quantity between 0 and 999999),
  reorder_at integer not null check (reorder_at between 0 and 999999),
  created_at timestamptz not null default now()
);

create unique index inventory_items_unique_style
  on public.inventory_items (category, lower(name), lower(variant));

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.inventory_items (id) on delete set null,
  item_name text not null,
  variant text not null,
  movement_type text not null check (movement_type in ('in', 'out')),
  quantity integer not null check (quantity between 1 and 999999),
  note text not null default '' check (char_length(note) <= 120),
  created_at timestamptz not null default now()
);

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  category text not null check (char_length(btrim(category)) between 1 and 60),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  image_url text not null default '' check (image_url = '' or image_url ~ '^https://'),
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  created_at timestamptz not null default now()
);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  email text not null check (char_length(btrim(email)) between 3 and 254),
  phone text not null default '' check (char_length(phone) <= 40),
  interest text not null check (char_length(btrim(interest)) between 1 and 100),
  details text not null check (char_length(btrim(details)) between 1 and 3000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.studio_admins enable row level security;
alter table public.inventory_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.catalog_items enable row level security;
alter table public.enquiries enable row level security;

create function public.is_studio_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.studio_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_studio_admin() from public, anon;
grant execute on function public.is_studio_admin() to authenticated;

create policy "Studio admins manage inventory"
  on public.inventory_items for all to authenticated
  using (public.is_studio_admin())
  with check (public.is_studio_admin());

create policy "Studio admins read stock movements"
  on public.stock_movements for select to authenticated
  using (public.is_studio_admin());

create policy "Catalog is public"
  on public.catalog_items for select to anon, authenticated
  using (true);

create policy "Studio admins manage catalog"
  on public.catalog_items for all to authenticated
  using (public.is_studio_admin())
  with check (public.is_studio_admin());

create policy "Visitors submit new enquiries"
  on public.enquiries for insert to anon, authenticated
  with check (status = 'new');

create policy "Studio admins read enquiries"
  on public.enquiries for select to authenticated
  using (public.is_studio_admin());

create policy "Studio admins update enquiries"
  on public.enquiries for update to authenticated
  using (public.is_studio_admin())
  with check (public.is_studio_admin());

grant select, insert, update, delete on public.inventory_items to authenticated;
grant select on public.stock_movements to authenticated;
grant select, insert, update, delete on public.catalog_items to authenticated;
grant select on public.catalog_items to anon;
grant insert on public.enquiries to anon, authenticated;
grant select, update on public.enquiries to authenticated;

create function public.record_stock_movement(
  p_item_id uuid,
  p_type text,
  p_quantity integer,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stock_item public.inventory_items%rowtype;
  next_quantity integer;
begin
  if not public.is_studio_admin() then
    raise exception 'Studio admin access is required.';
  end if;

  if p_type not in ('in', 'out') or p_quantity not between 1 and 999999 then
    raise exception 'Enter a valid stock movement.';
  end if;

  if char_length(coalesce(p_note, '')) > 120 then
    raise exception 'Movement notes must be 120 characters or fewer.';
  end if;

  select *
    into stock_item
    from public.inventory_items
    where id = p_item_id
    for update;

  if not found then
    raise exception 'That inventory item no longer exists.';
  end if;

  if p_type = 'out' and p_quantity > stock_item.quantity then
    raise exception 'Only % piece(s) of % (%) are in stock.',
      stock_item.quantity, stock_item.name, stock_item.variant;
  end if;

  next_quantity := stock_item.quantity
    + case when p_type = 'in' then p_quantity else -p_quantity end;

  if next_quantity > 999999 then
    raise exception 'That movement would exceed the maximum stock quantity.';
  end if;

  update public.inventory_items
    set quantity = next_quantity
    where id = stock_item.id;

  insert into public.stock_movements (
    item_id, item_name, variant, movement_type, quantity, note
  ) values (
    stock_item.id, stock_item.name, stock_item.variant, p_type, p_quantity, btrim(coalesce(p_note, ''))
  );
end;
$$;

revoke all on function public.record_stock_movement(uuid, text, integer, text) from public, anon;
grant execute on function public.record_stock_movement(uuid, text, integer, text) to authenticated;

create function public.add_inventory_item(
  p_name text,
  p_category text,
  p_variant text,
  p_quantity integer,
  p_reorder_at integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_item public.inventory_items%rowtype;
begin
  if not public.is_studio_admin() then
    raise exception 'Studio admin access is required.';
  end if;

  insert into public.inventory_items (name, category, variant, quantity, reorder_at)
  values (btrim(p_name), p_category, btrim(p_variant), p_quantity, p_reorder_at)
  returning * into new_item;

  if p_quantity > 0 then
    insert into public.stock_movements (
      item_id, item_name, variant, movement_type, quantity, note
    ) values (
      new_item.id, new_item.name, new_item.variant, 'in', p_quantity, 'Opening stock'
    );
  end if;

  return new_item.id;
end;
$$;

revoke all on function public.add_inventory_item(text, text, text, integer, integer) from public, anon;
grant execute on function public.add_inventory_item(text, text, text, integer, integer) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inventory_items'
  ) then
    alter publication supabase_realtime add table public.inventory_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stock_movements'
  ) then
    alter publication supabase_realtime add table public.stock_movements;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'catalog_items'
  ) then
    alter publication supabase_realtime add table public.catalog_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'enquiries'
  ) then
    alter publication supabase_realtime add table public.enquiries;
  end if;
end;
$$;

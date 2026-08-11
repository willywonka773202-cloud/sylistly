-- Catalog verification must describe an actual retailer-link check. Ingestion,
-- seeding, and search caching are not availability checks.

alter table products
  alter column last_checked_at drop default,
  add column if not exists link_health_status text,
  add column if not exists link_health_http_status integer,
  add column if not exists link_health_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_link_health_status_valid'
  ) then
    alter table products
      add constraint products_link_health_status_valid
      check (
        link_health_status is null
        or link_health_status in ('available', 'reachable', 'sold_out', 'dead', 'blocked', 'error')
      );
  end if;
end $$;

-- Existing last_checked_at values were written by ingestion/cache code without
-- a retailer check. A typed status is the evidence that distinguishes a real
-- verification, so clear ambiguous legacy timestamps once during migration.
update products
set last_checked_at = null
where link_health_status is null;

create index if not exists products_link_health_freshness
  on products(link_health_status, last_checked_at desc);

comment on column products.last_checked_at is
  'Retailer link/availability verification time only; never an ingestion or discovery timestamp.';
comment on column products.link_health_status is
  'Typed retailer-link outcome: available, reachable, sold_out, dead, blocked, or error.';

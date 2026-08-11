-- Honest retailer-click attribution for both database and bundled static items.
-- Route handlers write with the service role; browser clients receive no policy.

alter table clicks enable row level security;

alter table clicks
  add column if not exists external_product_id text,
  add column if not exists look_id text,
  add column if not exists surface text,
  add column if not exists campaign text,
  add column if not exists sub_id text,
  add column if not exists network_sub_id text,
  add column if not exists anonymous_id text,
  add column if not exists session_id text,
  add column if not exists destination_host text,
  add column if not exists affiliate_network text,
  add column if not exists redirect_status text,
  add column if not exists error_code text,
  add column if not exists metadata jsonb default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clicks_redirect_status_check'
  ) then
    alter table clicks
      add constraint clicks_redirect_status_check
      check (redirect_status is null or redirect_status in ('success', 'failure'));
  end if;
end $$;

create index if not exists clicks_clicked_at on clicks(clicked_at desc);
create index if not exists clicks_external_product on clicks(external_product_id);
create index if not exists clicks_network_sub_id on clicks(network_sub_id);
create index if not exists clicks_session on clicks(session_id, clicked_at desc);
create index if not exists clicks_look on clicks(look_id, clicked_at desc);
create index if not exists clicks_campaign on clicks(campaign, clicked_at desc);

comment on column clicks.external_product_id is
  'Product id for either a Supabase row or the bundled static catalog; avoids an invalid FK for static-only products.';
comment on column clicks.sub_id is
  'Requested per-product custom attribution value; never contains account or secret values.';
comment on column clicks.network_sub_id is
  'Exact compound token sent to the affiliate network for product/look/surface/campaign reconciliation.';
comment on column clicks.anonymous_id is
  'Opaque first-party browser identifier. No email, IP, or other PII is stored.';

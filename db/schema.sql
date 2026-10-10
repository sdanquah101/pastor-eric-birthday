-- Paste this into the Neon SQL Editor once.

create table if not exists wishes (
  id          bigserial primary key,
  name        text not null,
  relation    text,
  message     text not null,
  ip_hash     text,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists wishes_created_idx on wishes (created_at desc);
create index if not exists wishes_ip_idx on wishes (ip_hash, created_at);

create table if not exists gifts (
  id            bigserial primary key,
  reference     text not null unique,
  amount_minor  integer not null,          -- pesewas: divide by 100 for GHS
  currency      text not null default 'GHS',
  email         text,
  name          text,
  note          text,
  anonymous     boolean not null default false,
  channel       text,                      -- card, mobile_money, bank ...
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- Handy queries
-- Hide a wish:          update wishes set hidden = true where id = 123;
-- Total given:          select currency, sum(amount_minor)/100.0 as total, count(*) from gifts group by currency;
-- Gifts with notes:     select name, amount_minor/100.0 as amount, note, paid_at from gifts order by paid_at desc;

-- Hubtel: a gift is saved here when the giver starts paying, and moved into
-- gifts once Hubtel confirms it (callback, status check or "Mark as paid" on /admin).
create table if not exists pending_gifts (
  reference     text primary key,            -- our clientReference (max 32 chars)
  checkout_id   text,
  amount_minor  integer not null,
  currency      text not null default 'GHS',
  email         text,
  name          text,
  note          text,
  anonymous     boolean not null default false,
  provider      text not null default 'hubtel',
  status        text not null default 'pending', -- pending | paid | failed
  detail        text,                         -- last message from Hubtel
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists pending_gifts_status_idx on pending_gifts (status, created_at desc);

-- Direct MoMo gifts (self-reported): the sender's number and a hashed IP for rate limiting.
alter table gifts add column if not exists phone text;
alter table gifts add column if not exists ip_hash text;

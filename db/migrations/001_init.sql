create table if not exists content (
  id         int primary key default 1,
  doc        jsonb not null,
  updated_at timestamptz not null default now(),
  constraint content_singleton check (id = 1)
);

create table if not exists content_history (
  id       bigserial primary key,
  doc      jsonb not null,
  saved_at timestamptz not null default now()
);

create table if not exists messages (
  id         bigserial primary key,
  name       text not null,
  email      text not null,
  body       text not null,
  ip_hash    text,
  created_at timestamptz not null default now()
);

create index if not exists messages_ip_recent
  on messages (ip_hash, created_at desc);

create table if not exists schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);

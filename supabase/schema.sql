-- Run this once in Supabase -> SQL Editor -> New query -> Run.
-- Three tables: notes, drafts, voice_skill. Nothing is ever deleted:
-- rejected notes and drafts are the record of what needs improving.

create table if not exists notes (
  id                  bigint generated always as identity primary key,
  created_at          timestamptz not null default now(),
  chat_id             text not null,
  telegram_message_id bigint,
  source              text not null default 'text',      -- text | voice
  content             text not null,
  score               int,
  score_reason        text,
  topic               text,
  archetype           text,
  status              text not null default 'received'   -- received | rejected | drafted
);

create table if not exists drafts (
  id                  bigint generated always as identity primary key,
  created_at          timestamptz not null default now(),
  note_id             bigint references notes(id),
  chat_id             text not null,
  telegram_message_id bigint,
  content             text not null,
  model               text,
  voice_version       text,
  news_query          text,
  news_headline       text,
  news_source         text,
  news_url            text,
  status              text not null default 'pending',   -- pending | approved | rejected
  reviewed_at         timestamptz
);

create table if not exists voice_skill (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  version     text not null,
  content     text not null,
  is_active   boolean not null default true
);

create index if not exists drafts_lookup on drafts (chat_id, telegram_message_id);
create index if not exists drafts_pending on drafts (chat_id, status, created_at desc);

-- Lock the tables down: only the server (service_role key) can read/write.
alter table notes       enable row level security;
alter table drafts      enable row level security;
alter table voice_skill enable row level security;

-- Optional: store the voice skill here so you can update it without redeploying.
-- Paste the full contents of voice-skill.txt between the $$ markers and run:
-- insert into voice_skill (version, content) values ('v1.0', $$ ...paste here... $$);

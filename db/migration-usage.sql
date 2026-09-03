create table if not exists chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text,
  answer text,
  sources_count int,
  input_tokens int default 0,
  output_tokens int default 0,
  latency_ms int,
  created_at timestamptz not null default now()
);

create index if not exists chat_logs_user_id_idx on chat_logs(user_id, created_at desc);
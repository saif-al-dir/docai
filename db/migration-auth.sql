alter table documents
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- wipe ownerless test data (you'll re-upload after signing up)
delete from documents where user_id is null;

create index if not exists documents_user_id_idx on documents(user_id);
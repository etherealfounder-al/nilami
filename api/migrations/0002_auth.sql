-- Identity comes home.
--
-- 0001 left accounts with Supabase: profiles.id was a Supabase user id and
-- this database only recorded what that account could do. Approving someone
-- meant one write here and one call to another system, which is two
-- operations that can each fail where a transaction cannot.
--
-- Now the account lives here too. profiles.id is the account, password_hash
-- authenticates it, and a session is a row rather than a signed assertion —
-- so signing someone out is a delete, not a wait for a token to expire.

-- argon2id, in PHC string format, so the parameters travel with the hash and
-- older hashes keep verifying after the cost constants change. Empty means
-- the account cannot sign in: no password is not the same as any password.
alter table profiles add column if not exists password_hash text not null default '';

-- Login looks an account up by email, so email has to identify exactly one.
-- Nothing enforced that before, because Supabase owned the uniqueness. Folded
-- to lower case, since nobody expects capitals to make a second account, and
-- partial because 0001 defaults the column to '' and blank is not a login.
create unique index if not exists profiles_email_key
  on profiles (lower(email)) where email <> '';

-- Only a SHA-256 of each token is stored, so a copy of this database — a
-- backup, a dump sent somewhere — holds nothing that would sign anyone in.
create table if not exists sessions (
  id_hash    text        primary key,
  user_id    uuid        not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen  timestamptz not null default now(),
  user_agent text        not null default ''
);

-- Listing and revoking a person's sessions; sweeping expired rows at login.
create index if not exists sessions_user_idx   on sessions (user_id);
create index if not exists sessions_expiry_idx on sessions (expires_at);

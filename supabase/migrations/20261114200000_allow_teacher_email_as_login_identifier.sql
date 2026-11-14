alter table public.teacher_accounts
  drop constraint if exists teacher_accounts_username_format;

alter table public.teacher_accounts
  add constraint teacher_accounts_username_format
  check (
    username = lower(username)
    and length(username) between 3 and 254
    and (
      username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
      or username ~ '^[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9][a-z0-9.-]{0,187}\\.[a-z]{2,24}$'
    )
  );

alter type "Role" add value if not exists 'SUPER_ADMIN' before 'ADMIN';

update users
set role = 'SUPER_ADMIN'::"Role",
    status = 'ACTIVE',
    archived_at = null
where lower(email) = 'admin@ipsm.local';

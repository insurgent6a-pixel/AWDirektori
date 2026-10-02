-- Local stack only: give the service roles a password so auth, rest and storage can connect.
\set pgpass `echo "$POSTGRES_PASSWORD"`
ALTER USER postgres WITH PASSWORD :'pgpass';
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';

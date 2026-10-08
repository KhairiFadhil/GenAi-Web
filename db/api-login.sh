#!/bin/sh
# Docker init step: lets the app log in as ori_api, which can only call the api_* functions (see schema.sql)
set -e
psql -v ON_ERROR_STOP=1 -v pw="$ORI_API_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
alter role ori_api with login password :'pw';
SQL

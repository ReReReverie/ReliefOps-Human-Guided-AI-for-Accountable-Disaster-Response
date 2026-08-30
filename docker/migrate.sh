#!/bin/sh
set -eu

echo "Waiting for PostgreSQL at ${PGHOST}:${PGPORT:-5432}..."
until pg_isready -q; do
  sleep 1
done

for migration in /migrations/*.sql; do
  echo "Applying $(basename "$migration")..."
  psql --set ON_ERROR_STOP=1 --file "$migration"
done

echo "Database migrations complete."

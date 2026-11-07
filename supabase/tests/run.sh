#!/usr/bin/env bash
# Applies migrations to a throwaway database on a local PostgreSQL and runs RLS tests.
set -euo pipefail
DB=${EDGELOG_TEST_DB:-edgelog_test}
PSQL="psql -v ON_ERROR_STOP=1 -q ${PGURL:-}"
cd "$(dirname "$0")/.."
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB"
$PSQL -d "$DB" -c "drop role if exists anon" -c "drop role if exists authenticated" 2>/dev/null || true
$PSQL -d "$DB" -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do $PSQL -d "$DB" -f "$f"; done
$PSQL -d "$DB" -f tests/99_grants.sql
$PSQL -d "$DB" -f tests/rls.test.sql

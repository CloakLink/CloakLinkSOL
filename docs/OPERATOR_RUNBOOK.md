# Operator runbook

## Database migrations
- Ensure `DATABASE_URL` points at the target Postgres instance (the docker-compose stack exposes `postgresql://cloaklink:cloaklink@postgres:5432/cloaklink?schema=public`).
- Run migrations before starting API or indexer:
  ```bash
  npm run db:migrate
  npm run db:generate
  ```
- For development changes, generate a new migration without touching the database:
  ```bash
  npm run db:migrate:dev
  ```
- Reset a development database quickly (destroys data):
  ```bash
  npm run db:reset
  ```

## Backups and restores
- Create an on-demand backup from docker-compose Postgres:
  ```bash
  PGPASSWORD=cloaklink pg_dump \
    --username=cloaklink \
    --host=localhost \
    --port=5432 \
    --format=custom \
    --file=backups/cloaklink-$(date +%Y%m%d%H%M).dump \
    cloaklink
  ```
- Restore a backup (stops API/indexer first):
  ```bash
  PGPASSWORD=cloaklink pg_restore \
    --clean \
    --if-exists \
    --dbname=postgresql://cloaklink:cloaklink@localhost:5432/cloaklink \
    backups/cloaklink-<timestamp>.dump
  ```
- For production, schedule `pg_dump` and ship artifacts to durable storage; verify restores regularly.

## Indexer cursor recovery
- The indexer stores progress in the `IndexerCursor` table. To replay from scratch for a specific invoice, clear its cursor row:
  ```bash
  psql postgresql://cloaklink:cloaklink@localhost:5432/cloaklink -c "DELETE FROM \"IndexerCursor\" WHERE \"invoiceId\"='<invoice-id>';"
  ```
- To rewind all cursors (full rescan), truncate the table:
  ```bash
  psql postgresql://cloaklink:cloaklink@localhost:5432/cloaklink -c "TRUNCATE \"IndexerCursor\";"
  ```
- After a cursor reset, restart the indexer so it replays signatures from the beginning.

## Service health
- The docker-compose stack waits for Postgres before starting API/indexer. If startup fails, check Postgres logs and confirm migrations ran.
- API health: `GET http://localhost:4000/health`.
- Indexer health and metrics: `GET http://localhost:5001/health` (added during this iteration).

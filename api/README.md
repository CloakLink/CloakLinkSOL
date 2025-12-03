# CloakLink API

Express + Prisma API powering CloakLink.

## Environment
Copy `.env.example` to `.env` and adjust values. The default `DATABASE_URL` points to `../data/dev.db`.

## Database setup
1. Install dependencies from repo root: `npm install`.
2. Generate and migrate the database:
   ```bash
   cd api
   npx prisma migrate dev --name init
   npx prisma generate
   ```
3. Start the API: `npm run dev` (defaults to http://localhost:4000).

The server seeds a default profile using `DEFAULT_PROFILE_ALIAS`, `DEFAULT_RECEIVE_ADDRESS`, and `DEFAULT_CHAIN` on startup.

# Book Exchange (MVP)

This project is a minimal book-exchange site scaffolded into your existing Express/EJS app.

Features added:
- Book listing, add, view (MySQL via `mysql2` pool)
- Simple admin login (session-based)
- Real-time chat per-book using Socket.IO (no message persistence by default)

Quick start (Windows PowerShell) — use server.js (Option B):

```powershell
npm install
# generate bcrypt hash for admin password (replace YOUR_PASS)
npm run hash:pw -- YOUR_PASS
# initialize DB tables (ensure DB env vars are set)
npm run db:init
# run in dev mode
npm run dev
```

Notes:
- Create the database and run `db/init.sql` to create tables.
- Configure DB connection via environment variables: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- For admin login, set `ADMIN_USER` and `ADMIN_PASSWORD` or `ADMIN_PW_HASH`.

If you want, I can:
- Persist chat messages to the DB.
- Add admin UI to delete/edit books and view messages.
- Harden auth and add user accounts.

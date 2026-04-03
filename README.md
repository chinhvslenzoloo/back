# SRM SaaS Mini - Backend

## Setup

1. Copy `.env.example` to `.env`
2. Create MySQL database `srm_saas_mini`
3. Run schema:
   - `mysql -u root -p srm_saas_mini < src/config/schema.sql`
4. Install:
   - `npm install`
5. Run API:
   - `npm run dev`

## Notes

- This scaffold is multi-tenant by enforcing `tenant_id` from JWT.
- Soft delete uses `deleted_at`.
- Reminder emails are queued with Bull and sent by `src/jobs/reminderWorker.js`.
- CSV import/export endpoints:
  - `POST /csv/import/contacts` with `multipart/form-data`, field `file`
  - `GET /csv/export/contacts`

## Important

- Replace plain password logic with hashing (`bcrypt`) before production.
- Add Redis and Resend credentials in `.env`.

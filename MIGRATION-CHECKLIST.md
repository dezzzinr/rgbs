# Preserve-data cutover checklist

- [ ] Keep the completed Python project and deployment intact for rollback.
- [ ] Back up Neon / create a recovery branch; confirm the target database and branch.
- [ ] Copy the existing pooled and direct connection strings to Node `.env.local`.
- [ ] Keep the existing private R2 bucket, credentials and object keys.
- [ ] `npm ci` then `npm run db:status`; compare the old/new record counts.
- [ ] If already at `007_quote_requests`, only run `npm run db:check`. No migration is needed to change runtimes.
- [ ] If below 007, review missing migrations, then use `npm run db:upgrade -- --confirm-upgrade` and check again.
- [ ] Never bootstrap a populated database, stamp a revision manually, reset tables or reseed administrators.
- [ ] Existing administrator password signs in successfully. A changed hostname requires a new browser sign-in, not a password reset.
- [ ] Existing tracking IDs/tokens, history, payment records, quotes and private photographs remain available.
- [ ] Check one controlled shipment: payment gates, claim vs verification, unapproved coordinates and private photos.
- [ ] Verify provider keys and approved hostnames/domain restrictions. Review Smartsupp private-admin access and disable recording in its dashboard.
- [ ] Production cookies secure; demo and unverified quote bypass off; preview DB separate from production.
- [ ] Deploy only the Next project root with the included Next `vercel.json`, not the Python parent configuration.
- [ ] Switch production traffic only after controlled checks. Avoid simultaneous admin writers during validation.
- [ ] If rolling back to Python, keep schema at recognized 007 and retain records; do not downgrade or restore over new activity without a recovery plan.

No live database has been inspected, migrated, reset or deployed by this deliverable. Compatibility is verified locally with isolated PostgreSQL-engine tests. Review custom database changes and production access controls before cutover.

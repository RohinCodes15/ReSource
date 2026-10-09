# Deployment checklist — preparation only

No public deployment has been performed. Do not provision paid services or publish this project without the owner's explicit approval.

## Before choosing a host

- [ ] Choose an approved host (Vercel is compatible with this Next.js App Router app) and a managed PostgreSQL provider; review pricing, region, privacy and connection limits first.
- [ ] Use a fresh, dedicated production database. Back up and review the migration plan before applying `prisma migrate deploy`; never run `db push` against production.
- [ ] If the host is serverless, confirm the PostgreSQL provider's pooling/connection guidance and test the Prisma connection strategy under the host's runtime and limits.
- [ ] Add a deployment preview/staging environment with its own isolated database before production.

## Required production environment

Set values only in the host's encrypted environment-variable manager; do not commit them to `.env`, source code, screenshots or logs.

- `DATABASE_URL`: provider-issued PostgreSQL connection string for the approved production database (never reuse the integration-test URL).
- `AUTH_SECRET`: a newly generated high-entropy secret, unique to this deployment.
- `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`: values from the project's GitHub OAuth application.
- `AUTH_TRUST_HOST=true`: only if the platform/proxy validates and controls the forwarded host. Otherwise configure Auth.js according to the selected host's trusted-host setup.
- `DEMO_MODE=false` and `DEMO_DATABASE=false`; fictional Credentials identities must not be enabled in production.

Register the exact OAuth callback `https://YOUR_DEPLOYED_DOMAIN/api/auth/callback/github` in the GitHub OAuth app, and set the app's authorization callback/homepage URLs for the same domain. Add an administrator using the protected bootstrap procedure only after migration and confirm the GitHub numeric account subject. Do not provision public self-signup.

## Release sequence

1. Review the deployment diff and confirm no credentials, private data, or real organization records are present.
2. Run `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, Prisma validation, and `npm run build` in CI. PostgreSQL tests must run separately against an isolated local test database.
3. Configure a staging database and environment secrets; deploy a preview; apply only reviewed migrations; check OAuth sign-in/sign-out, session persistence, protected routes, role and organization boundaries, transfer lifecycle, concurrent approvals, cancellation, and audit trail.
4. Verify public `/demo` works without a database session and still labels every datum fictional and every action simulated. Confirm the production app has no demo credentials enabled.
5. Before production, obtain approval, snapshot/backup the database, apply the reviewed migration, deploy, smoke-test, verify logs do not disclose secrets, and exercise rollback/restore procedures.
6. Monitor database connection usage, error rate, authentication failures, backups, and migration status. Document an incident contact and restore owner.

## Current status

Local production build passes. This environment has no PostgreSQL server/credentials or GitHub OAuth credentials configured. Database-backed behavior, OAuth E2E, hosted connection pooling, HTTPS cookie behavior, backups, and public deployment are unverified. Do not mark these items complete until tested in the intended environment.

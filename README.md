# Lexify School

A mobile-first learning platform for Kenyan students, parents/guardians, teachers and guests. The app uses **Next.js App Router, React, TypeScript and Tailwind CSS**, with **Supabase Postgres, Auth, Storage, Realtime and Row Level Security** as the system of record. Paystack and PesaPal are isolated behind server-only provider adapters; test mode is the default.

## Local development

Requirements: Node.js 22 and pnpm 10.18.0.

```sh
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
# Fill in the Supabase URL and publishable key for the app to use Auth and public catalogue reads.
pnpm dev
```

Open the local development server on port 3000. `pnpm check`, `pnpm test`, and `pnpm build` run the TypeScript, unit-test and production-build checks. `.env.local` is ignored by Git. Never commit service-role, payment, mail or malware-scanner credentials.

## Supabase setup

Use Supabase as the only database/auth source; the inherited Drizzle/MySQL starter is not used by the application. Apply the SQL under `supabase/migrations/` to a new project in numeric order, then apply `supabase/seed.sql`. The seed is idempotent and contains no generated IDs or privileged users. Inspect each migration before running it in a shared project; migrations 002/003 replace permissive client-write paths with validated curriculum RPCs and server-controlled money operations.

Configure the Supabase Auth site URL and redirect URLs for the local app and the production site, including `/auth/callback`. Enable email verification, password recovery and MFA for administrators. Phone OTP requires an SMS provider and is not assumed to be available. Uploads use private buckets except profile avatars; protected files must be delivered only after an authenticated authorization check and through short-lived signed URLs.

The manual administrator promotion script is `supabase/admin_setup.sql`. First create and verify the intended Auth account, then set exactly one exact email or existing user UUID in the script and run it as a trusted Supabase operator. Admin is never a signup role. Do not store a production admin password in source control.

## Curriculum and account rules

Education systems, grades/cohorts, learning areas, pathways, tracks, subject groups, combinations, assessment scales and icon metadata are stored in editable tables. Seed assumptions are provisional and must be checked against current official KICD/KNEC materials before the public school relies on them. Junior School and KCSE selection rules run both in the UI and in the `save_student_subjects` database RPC. A learner cannot self-assign deaf-learner status; an administrator controls eligibility for Kenya Sign Language. Senior School combinations not in the verified approved dataset are marked for review rather than presented as officially approved.

The app deliberately avoids invented enrolment counts, teacher ratings, contact details, course prices, official examination grades or success claims. Draft Academy courses and unpublished products stay hidden until an administrator supplies verified content and prices. Class meeting links and paid course/product files are private. Teacher contact buttons build click-to-chat links without printing phone numbers into public page text.

## Environment and integrations

Copy `.env.example` to `.env.local` and configure only values actually available to the deployment. Browser-safe Supabase URL/publishable key values may be embedded in the client bundle; `SUPABASE_SERVICE_ROLE_KEY`, Paystack/PesaPal secrets and notification/malware-scan keys must remain server-side.

Payments are disabled or unavailable until test credentials, callback URLs and—on PesaPal—an approved public IPN URL/notification ID are configured. Test mode is the default. Do not switch to live mode until merchant approval, webhook/IPN configuration, refund reconciliation and an end-to-end test are complete. A browser redirect is not proof of payment; the server verifies provider status and amount before granting access. Tutoring commission defaults to the brief's 15% starting value and must be reviewed by the business owner before live use.

Email, SMS, WhatsApp and malware scanning are configurable integrations. WhatsApp is click-to-chat only; the platform does not send WhatsApp messages on behalf of users. If scanning is unavailable, dangerous file types must remain blocked and unscanned executable/macro files must not be distributed.

## Deployment

### Vercel

1. Import the repository into Vercel and select the Next.js framework.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` for the deployment build. Configure private Supabase service-role, provider and notification variables only as server-side environment variables.
3. Set the Supabase Auth site URL/redirect allowlist to the deployed HTTPS domain. Configure provider callback URLs only after that domain is stable.
4. Keep `PAYMENT_TEST_MODE=true` until verified; configure no live credentials in preview deployments.
5. Review the privacy, terms, child-safety, verified business-contact, curriculum and upload-scanning setup before accepting real users.

### Container

`Dockerfile` builds the standalone Next.js server with the pinned Node/pnpm toolchain and listens on `PORT` (default 3000). Run `pnpm build` to validate the deployment bundle. The application also exposes `/api/health` for readiness checks. Containers are stateless; durable user data belongs in Supabase Storage/Postgres.

## Decisions and pre-launch checks

- Four public signup roles are offered—student, parent, teacher and guest. Admin promotion is manual and identity-bound.
- Public curriculum/status records are data-driven; in October 2026 Grade 10 and Forms 3/4 are active, Grades 11/12 and Forms 1/2 are inactive/scheduled as configured in seed data. Recheck dates with the school before launch.
- Child community access is designed to require a confirmed parent link, consent and moderator controls; do not enable community features until the controls are operational.
- Terms, privacy and child-safety pages are initial product drafts, not legal advice. Obtain review by qualified Kenyan counsel and complete the actual data-retention, complaints, contact and rights-request procedures before launch.
- This repository does not include real provider credentials, a live admin identity, verified school contact details, approved official combinations, production email/SMS, malware-scanner credentials or a live merchant setup. Those need owner-supplied configuration and operational review.

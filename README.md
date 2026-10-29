# Lexify School

Lexify School is a mobile-first online-learning platform for Kenyan students, parents and guardians, teachers, and guests. The application uses **Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Auth, Postgres, Storage and Row Level Security**.

**Sales are handled outside the website.** Tutoring, Academy, and digital-resource listings may show seller-provided prices, but there is no on-site checkout or payment processing. An inquiry opens the seller's WhatsApp with a prefilled item-specific message. After independently confirming an external sale, a seller may issue a seller-reported PDF receipt; it is not a Lexify-verified payment or tax invoice.

## Local development

Requirements: Node.js 22 and pnpm 10.18.0.

```sh
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
# Set the Supabase URL and publishable key for this environment.
pnpm dev
```

Open the development server on port 3000. `pnpm check`, `pnpm test`, and `pnpm build` run TypeScript, unit-test, and production-build checks. `.env.local` is ignored by Git; never commit a service-role key or other private credentials.

## Supabase setup

Use Supabase as the database and authentication source; the inherited Drizzle/MySQL starter is not used by this application. Apply the reviewed migrations in numeric order to a new Supabase project, then run `supabase/seed.sql`. The migrations create application schema and security policies without payment tables or payment-provider integrations. Treat the Supabase database as shared by development and production, and do not run destructive operations against a populated project without a separate backup and explicit review.

The schema contains no payment tables or provider integrations. Prices are informational; class, course and product inquiries open the relevant seller's WhatsApp chat. The application counts aggregate outbound handoff clicks by listing and seller only; it cannot identify unique people, determine whether a message was sent, or infer a sale from a click.

Configure the Supabase Auth site URL and redirect allowlist for local and deployed HTTPS origins, including `/auth/callback`. Enable email verification and password recovery. Phone OTP is not assumed available without an SMS provider. Use private storage buckets for learner and course material; return files only after authorization and through short-lived signed URLs.

The manual administrator-promotion SQL is `supabase/admin_setup.sql`. First create and verify the intended Auth account, then set exactly one exact email or existing user UUID in the script and execute it as a trusted Supabase operator. Admin is not a signup role. Never store an admin password in source control.

## Curriculum and account rules

Education systems, grades/cohorts, learning areas, pathways, tracks, subject groups, combinations, assessment scales and icon metadata are stored in editable tables. Seed assumptions are provisional and should be checked against current official KICD/KNEC materials before the school relies on them. Junior School and KCSE subject-choice rules run in both the interface and the `save_student_subjects` database RPC. Learners cannot self-assign deaf-learner status; only an administrator may control eligibility for Kenya Sign Language. Senior School combinations without verified approval data must be presented for review rather than described as officially approved.

The application must not invent enrolment counts, ratings, contact details, prices, official examination grades, or success claims. Draft courses and unpublished products remain hidden until an administrator supplies verified content. Teachers provide their own seller contact details. Configure the platform seller's WhatsApp contact with the server-side `WHATSAPP_ADMIN_NUMBER` environment variable before offering inquiries for centrally managed courses or resources; when contact details are missing or invalid, the site must show a clear unavailable state instead of a dead or misleading action. Class meeting links and protected learning files remain private.

## WhatsApp handoff

Public seller links point to `/api/whatsapp/handoff`, which resolves the published listing and seller server-side, records one aggregate click by item and seller, and redirects to a validated `https://wa.me/<digits>?text=<encoded message>` destination. The application does not send WhatsApp messages. Counts mean outbound link clicks only—not unique people, messages delivered, bookings or sales—and no clicker identity, phone, message content or raw IP is recorded for this metric. Do not display phone numbers as public page text. If a seller number is missing or invalid, show the contact-unavailable state.

## Seller-issued receipts

Active teachers can manage their own records at `/teacher/receipts`; administrators can review all seller-issued receipts at `/admin/receipts` and issue platform receipts. Issuance requires the seller to attest that the sale was completed directly with the buyer outside Lexify School. An inquiry click never creates a receipt. A receipt records seller, receipt number/date, item and description, quantity, unit price and total in KES, plus an optional buyer name; do not enter a buyer phone number or payment credentials. The PDF uses the Lexify School mark and a QR code linking to public verification. That page exposes only the receipt number, seller, item, total and issue date. Receipts are seller-reported, not payment-verified by Lexify School, and are not tax invoices.

## Environment and integrations

Copy `.env.example` to `.env.local` and configure only values available in the deployment. Browser-safe Supabase URL and publishable-key values may be included in the client bundle. `SUPABASE_SERVICE_ROLE_KEY`, mail and malware-scanning credentials must remain server-only. No payment-gateway credentials, checkout URLs, callbacks or webhooks are part of this site.

Email, SMS, and malware scanning are optional configured services. If scanning is unavailable, dangerous file types remain blocked and unscanned executable/macro files must not be distributed. If a notification integration is missing, the application must report that honestly rather than claiming delivery.

## Deployment

### Vercel

1. Import the repository into Vercel and select the Next.js framework.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` (the public HTTPS origin used in receipt QR links). Keep service-role, mail and malware-scanning variables server-only.
3. Set Supabase Auth's HTTPS site URL and redirect allowlist for the deployment domain.
4. Set a verified `WHATSAPP_ADMIN_NUMBER` in the deployment's server-side environment before enabling central course or resource inquiries.
5. Review privacy, terms, child-safety, contact details, curriculum data and upload scanning before accepting real users.

### Container

`Dockerfile` builds the standalone Next.js server with the pinned Node/pnpm toolchain and listens on `PORT` (default 3000). Run `pnpm build` to validate the deployment bundle. `/api/health` is the readiness endpoint. Containers are stateless; durable user data belongs in Supabase Storage and Postgres.

## Decisions and pre-launch checks

- Four public signup roles are offered—student, parent, teacher and guest. Administrator promotion is manual and identity-bound.
- Curriculum/system status records are data-driven; recheck scheduled activation dates with the school before launch.
- Student community access must respect confirmed parent links, consent and moderation controls. Do not enable social features until these controls are operational.
- Terms, privacy and child-safety pages are product drafts, not legal advice. Obtain qualified Kenyan legal review and complete actual data-retention, complaints, contact and rights-request procedures before launch.
- No verified platform seller contact number, live admin identity, approved official combinations, production email/SMS, or malware-scanner credentials are supplied by default; the owner must configure the relevant values before relying on them.

# Lexify School — Implementation Plan

## Scope and architecture

Build the complete role-based platform defined by `/home/ubuntu/upload/lexifyschool.md` (Master Build Prompt, Version 3), replacing the earlier homepage-only scope. Follow its 13 phases, beginning with the project/auth foundation and curriculum, then role signup, public marketplace, payments, portals, PDFs, Academy, Projects Store, learning tools, admin, community and production polish.

The managed workspace started as a Vite/React/Express/tRPC starter with static hosting. The product brief explicitly selects Next.js App Router, React, TypeScript, Tailwind, and Supabase Postgres/Auth/Storage/Realtime/RLS/Edge Functions. Migrate this same project resource in place to Next.js and use the new, empty Supabase project `lexify school` (`ramwiruriaogrnaweabd`, `eu-west-1`) as the external source of truth. The project was created in the user's sole Supabase organization at a confirmed quote of $0/month. The user's older inactive Supabase project remains untouched. Enable the managed Node server for Next rendering/API routes; keep the Manus-managed MySQL database disabled so the app does not silently substitute it for Supabase.

Use Supabase server-side clients for protected operations and browser clients only for public/authenticated interactive views. RLS is required for every table. Server routes/Edge Functions own payment initialization/verification/webhooks/refunds, commission/ledger changes, entitlements, receipt/PDF generation, signed-URL issuance, badge awards, role checks and privileged admin work. Tests cover curriculum choice rules, role authorization, and provider-independent payment logic. All payment integrations stay in test mode until real credentials are configured; email and malware scan adapters remain explicitly environment-configured.

Curriculum is data-driven: systems, levels/status dates, learning areas, tracks, KCSE groups, subject relationships, rules, combinations, assessment scales and illustrations live in Supabase tables. Components consume those tables. A reusable accessible `SubjectCard` uses cached Lucide SVG icons from stored `icon_name`/`accent_color` when no custom SVG/PNG illustration exists. Junior rationalised/expanded mode and active dates remain admin-configurable. The supplied curriculum values are editable seed assumptions and are flagged for official KICD/KNEC verification.

Payments use a shared `PaymentProvider` contract (`initialize`, `verify`, `webhook`, `refund`) with Paystack and PesaPal adapters, KES amount normalization, provider-specific references kept private, signature-verified idempotent webhooks and entitlement only after server-side verification. Tutoring ledger splits default 15% commission, while course/product revenues remain platform revenue. No live transaction is simulated.

## Project structure

- `src/app/`: Next.js App Router layouts and public, auth, portal, admin, academy, projects, curriculum and API routes.
- `src/components/`: responsive application shell, role navigation, reusable `SubjectCard`, forms, course/product/class cards and accessible UI primitives.
- `src/lib/supabase/`: browser, server and service-role clients; auth, role guards, storage and RLS-aware queries.
- `src/lib/curriculum/`: rule evaluation, subject choice validation, assessment conversion and curriculum helpers; shared by UI and server validation.
- `src/lib/payments/`: provider interface, Paystack/PesaPal adapters, KES amount normalization, idempotent transaction orchestration and ledger utilities.
- `src/lib/whatsapp/`, `src/lib/pdf/`, `src/lib/notifications/`, `src/lib/security/`: safe chat-link construction, branded server PDFs, notification adapters, validation/rate limits and upload policy.
- `supabase/migrations/`: normalized tables, indexes, triggers, RLS policies and storage policies; `supabase/seed.sql` and manual admin setup SQL hold editable default curriculum/demo setup.
- `supabase/functions/`: deployable webhook, verification, entitlement/download and privileged document functions where appropriate.
- `tests/`: curriculum rules, authorization and payment idempotency tests.
- Root config: `.env.example`, `Dockerfile`, `vercel.json`, `README.md`, `TODO.md`, `plan.md`, `app.config.ts` and `/manus-routes.json`.

## Design direction

- **Design Movement:** modern Kenyan digital-school editorial, combining a dependable learning platform with the friendly clarity of a contemporary education marketplace.
- **Core Principles:** trustworthy for parents; energetic but calm for teenagers; mobile-first and low-bandwidth; curriculum and payment information always clear.
- **Color Philosophy:** deep royal blue `#1E3A8A` communicates trust and focus; warm gold `#F59E0B` signals progress and action; white/light-gray surfaces preserve readability, with dark mode for community and dashboards.
- **Layout Paradigm:** compact mobile-first navigation, focused page headers, scannable stacked cards and clear portal side navigation on wide screens; keep the homepage editorial and the commerce/catalogue pages filterable.
- **Signature Elements:** rounded subject cards with colored icon tiles; blue-to-gold progress accents; clear status badges for curriculum, paid content and verified teachers.
- **Interaction Philosophy:** minimize typing on mobile, explain disabled/invalid curriculum choices inline, keep actions explicit, and preserve access/security states in the UI rather than pretending an unavailable backend operation succeeded.
- **Animation:** brief opacity/position transitions and progress feedback only; respect reduced-motion settings and avoid decorative motion that costs bandwidth.
- **Typography System:** Inter for interface and body text with a bold geometric display treatment; large headlines, compact labels and highly legible form copy.
- **Brand Essence:** a dependable Kenyan learning hub connecting learners, guardians and teachers with curriculum-aligned tutoring and practical digital skills; **smart, supportive, credible**.
- **Brand Voice:** encouraging, direct and reassuring. Examples: “Learn at your pace. Grow with the right support.” / “Your next step starts with a subject you can see and understand.”
- **Wordmark & Logo:** clean “Lexify School” text wordmark paired with a small graduation-cap/open-book mark; maintain a replaceable SVG/PNG slot for the official logo across site and documents.
- **Signature Brand Color:** deep royal blue `#1E3A8A`.

## Serving and material constraints

Use the enabled WebDev Node server for Next.js preview and managed publication; the app must honor `PORT`. Keep the code Vercel-compatible and document deployment. Supabase auth/storage/realtime and payment/email/malware services are external and must use server-only secrets where appropriate. The new Supabase project is available for schema migrations; no live payment or email credentials have been supplied. Create a static route manifest for implemented page routes before starting Preview. Preserve the project's configured port and history. Auto-publication is disabled; do not publish until asked.

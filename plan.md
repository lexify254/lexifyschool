# Lexify School — Implementation Plan

## Scope and architecture

Build the role-based Lexify School platform in the existing Next.js project, using the user's latest instruction as the scope authority: **all on-site payment processing is excluded**. Tutoring, Academy, and project-store prices are informational listing details. A booking or purchase-intent button opens a WhatsApp chat with the relevant seller and an item-specific prefilled message. A WhatsApp handoff is not represented as a completed booking, purchase, payment, entitlement, refund, or receipt.

Use Next.js App Router, React, TypeScript and Tailwind, with the existing Supabase project `lexify school` (`ramwiruriaogrnaweabd`, `eu-west-1`) as the external source of truth for Auth, Postgres, Storage and Realtime. The Supabase project is healthy and currently empty. The WebDev Node server is enabled for Next rendering/API routes; the Manus-managed MySQL database remains disabled. Apply the reviewed non-destructive schema and curriculum seed to this empty project after the application changes are prepared. Do not apply the legacy payment-functions migration.

Use server-side Supabase clients for protected operations and browser clients only for public/authenticated interactive views. RLS must enforce data ownership and roles. Server routes own role checks, content administration, learning-data mutations, access-controlled downloads and PDF generation. Seller contact links use the existing normalized Kenyan WhatsApp URL builder; missing/invalid contact details fail closed with an explanatory message. Payment gateways, checkout, webhooks, refund handling, commission, transaction ledgers, payouts and payment receipts are out of scope. Email and malware-scanning adapters remain environment-configured and must never imply successful delivery when unavailable.

Curriculum remains data-driven: education systems, levels/status dates, learning areas, tracks, KCSE groups, subject relationships, rules, combinations, assessment scales and illustrations live in Supabase. Signup and curriculum management consume those records. A reusable accessible `SubjectCard` uses cached Lucide icons from stored `icon_name`/`accent_color` when there is no custom SVG/PNG illustration. Seed curriculum values are provisional and require official KICD/KNEC verification before institutional use.

## Project structure

- `src/app/`: Next.js App Router layouts and public, auth, role-portal, admin, Academy, project-store and API routes.
- `src/components/`: responsive application shell, role navigation, reusable `SubjectCard`, signup forms, course/product/class cards, learning controls and accessible UI primitives.
- `src/lib/supabase/`: browser, server and privileged clients; session handling, role guards, storage and RLS-aware queries.
- `src/lib/curriculum/`: rule evaluation, subject-choice validation, assessment conversion and curriculum helpers shared by UI and server validation.
- `src/lib/whatsapp/`: validated seller contact normalization and item-specific `wa.me` messages; no WhatsApp API or automated sending.
- `src/lib/pdf/`, `src/lib/notifications/`, `src/lib/security/`: branded reports/certificates, optional notification adapters, validation/rate limits and upload policies.
- `supabase/migrations/`: application tables, indexes, triggers, RLS and storage policies; `supabase/seed.sql` and manual admin setup SQL hold editable curriculum and safe defaults.
- `tests/`: curriculum, authorization, WhatsApp URL, and core feature tests; no payment-provider tests.
- Root configuration: `.env.example`, `Dockerfile`, `vercel.json`, `README.md`, `TODO.md`, `plan.md`, `app.config.ts` and `public/manus-routes.json`.

## Design direction

- **Design Movement:** modern Kenyan digital-school editorial, combining a dependable learning platform with the friendly clarity of a contemporary education marketplace.
- **Core Principles:** trustworthy for parents; energetic but calm for teenagers; mobile-first and low-bandwidth; prices and WhatsApp handoffs are clear and honest.
- **Color Philosophy:** deep royal blue `#1E3A8A` communicates trust and focus; warm gold `#F59E0B` signals progress and action; white/light-gray surfaces preserve readability, with dark mode for community and dashboards.
- **Layout Paradigm:** compact mobile-first navigation, focused page headers, scannable stacked cards and clear portal side navigation on wide screens; keep the homepage editorial and catalogue pages filterable.
- **Signature Elements:** rounded subject cards with colored icon tiles; blue-to-gold progress accents; clear content-status and teacher-verification labels.
- **Interaction Philosophy:** minimize typing on mobile, explain disabled/invalid curriculum choices inline, make WhatsApp seller handoffs explicit, and never pretend an unavailable backend operation succeeded.
- **Animation:** brief opacity/position transitions and progress feedback only; respect reduced-motion settings and avoid decorative motion that costs bandwidth.
- **Typography System:** Inter for interface and body text with a bold geometric display treatment; large headlines, compact labels and highly legible form copy.
- **Brand Essence:** a dependable Kenyan learning hub connecting learners, guardians and teachers with curriculum-aligned tutoring and practical digital skills; **smart, supportive, credible**.
- **Brand Voice:** encouraging, direct and reassuring. Examples: “Learn at your pace. Grow with the right support.” / “Ask the seller about a class or course on WhatsApp.”
- **Wordmark & Logo:** clean “Lexify School” text wordmark paired with a small graduation-cap/open-book mark; maintain a replaceable SVG/PNG slot for the official logo across site and documents.
- **Signature Brand Color:** deep royal blue `#1E3A8A`.

## Serving and material constraints

Use the enabled WebDev Node server for Next.js preview and managed publication; the app must honor `PORT`. Keep the code Vercel-compatible and document deployment. Supabase Auth/Storage/Realtime and email/malware services are external and must use server-only secrets where appropriate. Do not include payment-provider keys or checkout routes. Keep `/manus-routes.json` synchronized with the implemented page routes. The current project configuration has auto-publication enabled, so checkpoint pushes may publish; do not change this setting. Preserve the project's configured port, canonical repository and existing history.

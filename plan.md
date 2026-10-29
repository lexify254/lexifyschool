# Lexify School — Implementation Plan

## Scope and architecture

Build the role-based Lexify School platform in the existing Next.js project, using the user's latest instruction as the scope authority: **all on-site payment processing is excluded**. Tutoring, Academy, and project-store prices are informational listing details. A booking or purchase-intent button opens a WhatsApp chat with the relevant seller and an item-specific prefilled message. Each internal handoff records an aggregate outbound-click event; the platform cannot determine whether a WhatsApp message is sent or received, so metrics must be labelled as handoff clicks rather than people contacted or completed inquiries. A seller may manually issue a separate receipt only after confirming a sale arranged outside Lexify School. The receipt is seller-reported, not a Lexify-verified payment or tax invoice.

Use Next.js App Router, React, TypeScript and Tailwind, with the existing Supabase project `lexify school` (`ramwiruriaogrnaweabd`, `eu-west-1`) as the external source of truth for Auth, Postgres, Storage and Realtime. The WebDev Node server is enabled for Next rendering/API routes; the Manus-managed MySQL database remains disabled. Apply additive, reviewed Supabase migrations; do not reintroduce payment-provider tables or functions.

Use server-side Supabase clients for protected operations and browser clients only for public/authenticated interactive views. RLS must enforce data ownership and roles. Server routes own role checks, content administration, learning-data mutations, access-controlled downloads, PDF generation, inquiry-event logging, and receipt issuance/verification. Seller contact links use the existing normalized Kenyan WhatsApp URL builder; missing/invalid contact details fail closed with an explanatory message. Payment gateways, checkout, payment webhooks, refunds, commissions, transaction/payment status, payouts, and payment credentials remain out of scope. Email and malware-scanning adapters remain environment-configured and must never imply successful delivery when unavailable.

Curriculum remains data-driven: education systems, levels/status dates, learning areas, tracks, KCSE groups, subject relationships, rules, combinations, assessment scales and illustrations live in Supabase. Signup and curriculum management consume those records. A reusable accessible `SubjectCard` uses cached Lucide icons from stored `icon_name`/`accent_color` when there is no custom SVG/PNG illustration. Seed curriculum values are provisional and require official KICD/KNEC verification before institutional use.

## Project structure

- `src/app/`: Next.js App Router layouts and public, auth, role-portal, admin, Academy, project-store, receipt-verification and API routes.
- `src/components/`: responsive application shell, role navigation, reusable `SubjectCard`, signup forms, course/product/class cards, learning controls, WhatsApp handoff links and seller receipt forms.
- `src/lib/supabase/`: browser, server and privileged clients; session handling, role guards, storage and RLS-aware queries.
- `src/lib/curriculum/`: rule evaluation, subject-choice validation, assessment conversion and curriculum helpers shared by UI and server validation.
- `src/lib/whatsapp/`: validated seller contact normalization, item-specific `wa.me` destinations and minimal handoff tracking; no WhatsApp API or automated sending.
- `src/lib/pdf/`: branded learning reports, certificates and seller-issued receipt PDFs using the existing PDFKit/QRCode dependencies and Lexify mark.
- `src/lib/notifications/`, `src/lib/security/`: optional notification adapters, validation/rate limits and upload policies.
- `supabase/migrations/`: application tables, indexes, triggers, RLS, storage policies, aggregate WhatsApp handoff events and seller receipt records; `supabase/seed.sql` and manual admin setup SQL hold editable curriculum and safe defaults.
- `tests/`: curriculum, authorization, WhatsApp URL, receipt policy and core feature tests; no payment-provider tests.
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
- **Wordmark & Logo:** clean “Lexify School” text wordmark paired with a small graduation-cap/open-book mark; use the existing `public/lexify-mark.svg` in receipts.
- **Signature Brand Color:** deep royal blue `#1E3A8A`.

## WhatsApp handoff counts and seller receipts

- Replace any payment-count metric with two distinct records: aggregate outbound WhatsApp handoff clicks, and seller-issued receipt records. A click is not evidence of a sent message, a unique person, a completed sale, or payment. Do not store the clicker's name, phone number, message text, or raw IP; aggregate by listing and seller only.
- Public and authenticated WhatsApp actions route through a same-origin endpoint which validates the published item and seller, records the handoff event, and redirects to the validated `wa.me` destination. It must not accept arbitrary redirect hosts. If logging fails, preserve the seller handoff; if a contact is missing, do not create a misleading button.
- Teachers may issue receipts only for their own seller profile; administrators may issue platform receipts and view all records. Receipt creation is a manual seller action after the seller confirms the externally arranged sale; a handoff click never creates a receipt. Store a snapshot of seller, receipt number, issue date, item/description, quantity, unit price and total in KES, plus an optional buyer name. Do not store payment credentials, method, status, or processor identifiers.
- Generate a downloadable server-side A4 PDF with the existing Lexify School logo, receipt number, seller and item details, amount/date, and a QR code to a public verification page. The verification page exposes only the receipt number, seller, item, total and issue date—not buyer details—and states that it is seller-issued, not verified or processed by Lexify School, and is not a tax invoice. Only the owning seller and administrators may access full receipt data or download PDFs.
- Use the current Lexify dashboard and document styles; no new decorative assets are needed. Existing `pdfkit`, `qrcode`, and `public/lexify-mark.svg` are available. Build QR links from `NEXT_PUBLIC_SITE_URL` when configured, otherwise use the current published Lexify origin; never derive a public receipt URL from an internal Preview host. Update the environment value if the public domain changes.

## Interface polish and teacher verification

- Upgrade the public teacher, Academy, and Projects catalogues' GET search inputs to consistent, polished, icon-led search fields with visible keyboard focus, responsive sizing and clear labels. Keep their current server-side filtering, URL parameters, and no-JavaScript form submission behavior intact.
- Refine the account-role chooser and all role signup screens with a layered, high-contrast, responsive brand background and clearer role icons. Preserve all current Supabase email/SMS signup, validation, curriculum selection, metadata persistence, and error recovery behavior; do not imply that an account was created until the backend confirms it.
- Add a restrained, accessible dynamic banner only to the teacher dashboard for the free verification request path. Teachers with an unverified/revoked profile can submit a claim for administrator review; pending and verified states must be explicit. Honor reduced-motion preferences and do not imply a paid badge or automatic verification.
- Provide administrators with a protected review queue that can approve/reject a teacher request, update the existing administrator-controlled verification state, and record the reviewer/time. Keep verification changes out of teacher-controlled profile updates and enforce roles in server code and Supabase RLS/RPCs.
- Confirm the protected Admin receipts page allows an administrator to manually issue and download the existing branded PDF receipt after attesting to a completed sale arranged outside Lexify School, in addition to reviewing seller-issued receipts. Preserve the no-payment boundary.
- The administrator's access is attached to the existing Supabase Auth user UUID and admin role, not only to the email string; a verified email change must not silently remove the role or allow signup to self-select admin.

Reuse Lucide icons and existing brand colors. Implement the signup backdrop and teacher banner with lightweight CSS rather than adding dependencies or decorative image assets. Banner motion is optional, brief, and disabled for `prefers-reduced-motion`.

## Serving and material constraints

Use the enabled WebDev Node server for Next.js preview and managed publication; the app must honor `PORT`. Keep the code Vercel-compatible and document deployment. Supabase Auth/Storage/Realtime and email/malware services are external and must use server-only secrets where appropriate. Do not include payment-provider keys or checkout routes. Keep `/manus-routes.json` synchronized with the implemented page routes. The current project configuration has auto-publication enabled, so checkpoint pushes may publish; do not change this setting. Preserve the project's configured port, canonical repository and existing history.

# Lexify School — Delivery Checklist

Scope follows `lexifyschool.md` (Master Build Prompt, Version 3), which replaces earlier Lexify briefs. Keep this list aligned with the numbered phases in that brief; do not mark externally dependent integrations complete until they are configured and verified.

## Scope change from the user (2026-10-28 and 2026-10-29)

- Payment processing remains excluded. Do not build or expose gateways, on-site checkout, webhooks, payment credentials/status, refunds, commissions, payment ledgers, or payouts.
- Route seller inquiries and purchase questions to the seller's WhatsApp number using a safe `https://wa.me/<digits>?text=<encoded message>` destination. Record aggregate outbound handoff clicks by listing/seller only; label them as clicks, not unique people, sent messages, received inquiries, sales, or payments. Do not store the clicker's name, phone, message content, or raw IP.
- After a seller manually confirms a sale arranged outside Lexify School, allow that seller to issue a downloadable PDF receipt with the Lexify School logo, a unique receipt number, issue date, seller, item/description, quantity, unit price/total in KES, optional buyer name, and a QR link to public verification. The receipt is seller-reported, not a Lexify-verified payment or tax invoice; no click automatically creates a receipt. The public QR page must not expose buyer name/contact details.

## Current request — school seal and Vercel deployment readiness

- [x] Use the supplied Lexify School seal as the shared site logo and browser icon, retain the existing text wordmark, and use the seal in seller-reported PDF receipts and platform branding.
- [x] Fix the missing Vercel homepage background by serving the hero image from the committed `public/` directory instead of a Manus-only storage URL; keep the image compressed and its free-use source documented.
- [ ] Activate and verify every feature in the established site scope before describing the whole platform as launch-ready. The current codebase still has open outcomes in Phases 1–13 below; preserve those as incomplete and do not add on-site payments, checkout or payment credentials.
- [ ] Complete Vercel-specific setup outside this repository: set the required environment values in Vercel and configure the Supabase HTTPS site URL/redirect allowlist for the actual deployment domain.

## Current request — accounts, teacher profiles and verification pricing

- [x] Parent signup asks for the parent's name, email/password and an optional student ID to link to their child. It does not ask a parent for grade, class, curriculum or student-specific fields. The server resolves the ID through an authenticated RPC and creates only a pending request for a valid student; the student must confirm before access is granted, and unrelated parents cannot discover or read the child's details.
- [x] Students receive a durable unique student ID that they can view and copy from their profile to share with a parent. Do not use the student's email, full name or raw Auth UUID as the public lookup value.
- [x] Student, parent, teacher and guest accounts can upload a profile picture. The upload validates image type/size, stores under an owner-scoped private path, and enforces ownership in Storage policies.
- [x] Keep authenticated users signed in while they move between Home and other sections. Show the signed-in user's avatar at the upper-right of shared navigation; clicking it opens the role-appropriate workspace, with an accessible fallback when there is no photo. `/profile` remains the account-settings route.
- [ ] Teachers can select more than one curriculum-linked subject, choose services they offer (including tuition), set informational pricing, and upload teaching materials. Profile editing, multiple-subject visibility, tuition flags and pricing are implemented; supported teacher uploads are private, owner-scoped, type/signature checked and capped at 100 MiB. Malware scanning is not performed, per the user's latest instruction. A teacher may change only their own profile and files; do not create fictional teachers, classes, service details or prices.
- [x] The public teacher search has a polished icon-led search field, clearly grouped filters and an explicit URL-backed sort choice. Keep search and filters usable on mobile and backed by actual teacher records; do not present fabricated marketplace entries.
- [x] Eligible teachers can request a verified badge. The request explains that verification may help them reach more students, shows the Admin-configured fee and offers a two-week free trial starting only after Admin approval. If Admin has not configured a fee, the interface displays that state clearly rather than inventing a price. Show request, trial, expired and rejection states truthfully.
- [x] Admin can configure the verification fee and review requests, approve/reject them, start the 14-day trial, and manually continue or revoke verification. Preserve UUID-based Admin authorization. Keep fee arrangement outside Lexify through WhatsApp when available; do not add checkout, card collection or automatic billing.
- [x] Explain that the owner opens `/admin` after signing in with a verified Auth account and completing the protected Admin promotion/claim if not already promoted; subsequent access is bound to the Supabase Auth UUID and Admin role. Never grant Admin based only on an email or password entered into a client form. No Admin Auth user exists in the live project yet.
- [ ] Account signup for every public role completes without a misleading success message or uncaught error. TypeScript, unit and production-build checks pass, but no live signup was attempted and no production test accounts were created; keep required email verification and actionable validation/backend errors, and never bypass Supabase Auth or guardian consent.

## Delivered milestone — landing page and role routes

- [x] Create the Lexify School landing page from the supplied reference, with public navigation, a student-learning hero, calls to action, curriculum/computer-package categories, Why Lexify, community, and account creation sections.
- [x] Create page routes for Admin, Student, Parent, Teacher, and Guest. Protect the Admin area with a server-side role check and show a not-found response to non-admin visitors.

## Phase 1 — Project setup, Supabase schema, authentication and roles

- [x] Use Next.js App Router, React, TypeScript and Tailwind; use Supabase Postgres, Auth, Storage, Realtime, RLS and Edge Functions/server routes. Provide Vercel-compatible deployment instructions.
- [x] Implement roles `student`, `parent`, `teacher`, `guest`, `admin`; public signup offers only Student, Parent, Teacher or Guest. Provide a one-time first-Admin claim only after the designated owner's email is verified; bind the resulting Admin role to the Supabase Auth UUID and never expose Admin as a public signup role.
- [x] Visiting `/admin` while signed out opens a simple email/password login. Successful login redirects student to `/student/dashboard`, parent to `/parent/dashboard`, teacher to `/teacher/dashboard`, guest to `/guest/dashboard`, and an authorized Admin UUID to `/admin`. A first-time Admin account can be created from the login page, must verify its email, and can then claim the initial Admin role.
- [ ] Enforce authorization on the server and in database RLS, not only by hiding UI. A non-admin who opens `/admin` receives a plain 404; include login rate limiting and Supabase MFA support for admin.
- [x] Block suspended accounts in protected server pages/APIs and authenticated public-schema/Storage RLS policies; preserve each user's own profile-status read so the suspension notice still works.
- [x] Use email/password signup with required email verification and password reset; remove SMS/phone-OTP signup. No phone number is required to create a student, teacher or parent account; teacher WhatsApp is optional.
- [ ] Keep secure avatar upload, validation, friendly onboarding progress and guest upgrade to student/parent while preserving course access and learning progress.
- [x] Create `.env.example` with Supabase, WhatsApp contact, email and malware-scan settings; never commit secrets.

## Phase 2 — Curriculum schema, seed data, illustrations and Curriculum Manager

- [ ] Store education systems, levels and statuses in database tables with `is_active`, `starts_on`, `ends_on`; admins can activate/deactivate and schedule levels without code changes.
  - Progress: public/signup curriculum views now honor date windows, and an additive migration adds public RLS gating plus subject-assignment write guards. The migration still needs application and verification after the bound Supabase project is accessible; this outcome remains open.
- [ ] Seed Junior School CBE Grades 7–9 as active; Senior School CBE Grade 10 active, Grade 11 starts January 2027, Grade 12 later; 8-4-4 Forms 3 and 4 active, Forms 1 and 2 inactive records; guests have no curriculum.
- [ ] Store learning areas/subjects, grade relationships, pathways, tracks, KCSE groups, strands/sub-strands, combination rules, approved combinations, competencies/values, assessment scales and illustrations in editable tables; do not hard-code the curriculum in page components.
- [ ] Implement reusable illustrated `SubjectCard` everywhere subjects appear. It displays illustration, clear title, grade/pathway tag, optional role line and selected/locked/disabled state with reason; accessible alt text/contrast and lightweight cached Lucide SVG defaults. Store `title`, `illustration_url`, `icon_name`, `accent_color`; allow admins to upload custom SVG/PNG illustrations.
- [ ] Seed the supplied icon/accent mappings, extending them for all curriculum and Computer Packages subjects. Junior mode defaults to rationalised; support admin choice between rationalised and expanded curriculum modes.
- [ ] Junior CBE has the 9 rationalised learning areas: English; Kiswahili or Kenya Sign Language for deaf learners; Mathematics; Integrated Science (including Health Education); Social Studies (including Life Skills); one of CRE/IRE/HRE; Agriculture (including Home Science/Nutrition); Pre-Technical Studies (including Business and Computer Studies); Creative Arts and Sports. Optional tutoring extras are stored separately.
- [ ] Senior CBE has 4 core areas plus exactly 3 electives (7 total), one of STEM, Social Sciences, or Arts and Sports Science, tracks, pathway-specific electives, and admin-editable core/examinable flags. Physical Education remains optional pending confirmation. Store lesson/timetable guidance as informational settings.
- [ ] Enforce Senior rules in UI, server/API and database: exactly 3 electives from one pathway by default; no overlapping combinations; one religious education subject; KSL only for deaf learners; Core Mathematics for STEM Pure Sciences, Essential Mathematics for other pathways; admin-configurable exception; warning (not hard block) for combinations absent from imported Ministry-approved CSV; first-term review setting; Grades 11/12 inherit Grade 10 pathway/combination unless edited by admin.
- [ ] 8-4-4 groups I–V and subject codes are admin-editable. KCSE selection requires 7–9 subjects, all Group I, at least 2 Group II, at least 1 Group III, at least 1 from remaining groups, and at most one religious education. KCSE projected mean uses 7 subjects (2 compulsory plus best 5 others). Label Form 3 as final cohort sitting KCSE 2027 and Form 4 sitting KCSE 2026.
- [ ] Basic Curriculum Manager supports systems, levels/status dates, pathways/tracks, learning areas/illustrations, strands, combination rules, KCSE groups, approved-combination CSV import/export, assessment scales and audit log.

## Phase 3 — Role-specific signup and subject-choice flows

- [x] Student signup uses full name, email/password and verified email, then simple education-system and grade dropdowns plus a subject dropdown for the selected curriculum. Keep live catalogue/rule validation and the required parent/guardian-consent checkbox; remove SMS signup and defer nonessential profile details.
- [ ] Junior student chooses CRE/IRE/HRE, Kiswahili or KSL only if deaf, and optional extra tutoring subjects.
- [ ] Senior student chooses pathway/track and exactly three valid electives subject to stored rules; show clear invalid-choice messages.
- [ ] 8-4-4 student chooses KCSE subjects subject to Group I–V rules.
- [x] Teacher signup uses name, email/password and verified email, then curriculum-backed active grade and subject dropdowns; WhatsApp and other profile details can be added later. No national ID or TSC number is required.
- [ ] Parent signup uses the parent's name, email/password and a student ID to link to their child. Remove grade, class, curriculum and other student-specific fields from the parent form; validate the ID server-side and enforce parent–student RLS.
- [x] Guest signup stays light: name, email/password, verified email, and consent checkbox “I am 18 or older, or my parent/guardian has given consent.” No SMS signup; no grade/pathway/guardian fields; after signup go to Computer Packages Academy.

## Phase 4 — Public pages, teacher marketplace and WhatsApp

- [ ] Build public Home, teacher/subject browse, teacher profile, `/academy`, `/projects`, curriculum guide/pathway helper, how-it-works/pricing, About, Contact, Terms, Privacy, Child-Safety, signup and login pages.
- [ ] Public Home includes hero, how it works, Junior/Senior/8-4-4/Computer Packages/Projects categories, featured teachers and testimonials.
- [ ] Teacher browse filters by education category, level, pathway, illustrated subject, price, pricing basis and rating; display verified badge and provide a clearly arranged sort selector in addition to the professional search box.
- [ ] Teacher profile shows photo, bio, illustrated subjects, price/pricing basis, reviews, verified badge, Chat on WhatsApp and inquiry actions.
- [ ] Teachers can define classes with category, level, subject/strand, schedule, meeting link, capacity and informational price; pricing basis per class is lesson bundle of N, weekly or monthly.
- [ ] WhatsApp click-to-chat uses the normalized signup number in `https://wa.me/<digits>?text=<encoded message>`, with useful prefilled class/subject messages, buttons rather than raw phone numbers, and clear note that click-to-chat URLs necessarily contain the number. Add links on teacher, class, booking/enrolment, parent/teacher lists, course and product pages.

## Phase 5 — Seller WhatsApp handoff (payment processing excluded)

- [x] Class booking, course enrolment inquiry, and project/product purchase actions open the relevant seller's WhatsApp with a clear prefilled item-specific message.
- [x] Normalize and validate the seller's WhatsApp number before creating `wa.me` links; if no valid number is configured, show a clear contact-unavailable message instead of a dead button.
- [x] Configure `WHATSAPP_ADMIN_NUMBER` for project/store inquiries through secure project settings; the value is present for all environments and passes the app's Kenyan phone-format check. The number itself is not committed to the repository.
- [x] Count each same-origin seller WhatsApp handoff by published item and seller; show totals to administrators and the owning teacher. State clearly that the total measures outbound link clicks only, not unique people, messages, bookings, or purchases; store no clicker name, phone, message text, or raw IP.
- [x] After manually confirming an externally arranged sale, let an authorized teacher or administrator create and download a seller-issued receipt; never generate one from a WhatsApp click. Preserve the payment-free scope: do not create an on-site checkout, payment status, payment credentials, commission, payout, or refund workflow.

## Pre-deployment request — interface polish, verification claims and Admin receipts

- [x] Make the Teachers, Academy and Projects catalogue search inputs look professional and consistent, add a clear search icon, retain readable labels and visible keyboard focus, and preserve each page's working GET-based search/filter behavior.
- [x] Improve the account-role chooser and role signup screens with a polished, responsive background and clear role icons while preserving Supabase email/password registration with required email verification, validation, curriculum selection, metadata persistence, and error/recovery paths; do not offer SMS/phone-OTP signup.
- [x] Show an accessible dynamic verification banner only to teachers who are eligible to claim. Let an unverified/revoked teacher submit a free claim for administrator review; show pending/approved/rejected states truthfully, respect reduced-motion settings, and do not imply automatic verification or payment.
- [x] Give administrators a protected verification-request queue to review and approve/reject teacher claims; update the existing administrator-controlled verification status and record reviewer/time without allowing teachers to set their own status.
- [x] Verify `/admin/receipts` lets an administrator issue and download a branded receipt after explicitly attesting to a completed off-platform sale, as well as review seller-issued receipts; no payment status, gateway, checkout or payment credential is introduced.
- [x] Preserve administrator authorization when an administrator changes their verified Auth email; authorization must remain bound to the existing Auth user ID and admin role, not to a public email string. Admin must remain unavailable as a public signup role.

## Phase 6 — Student, Parent and Teacher portals; attendance and assessments

- [ ] Student dashboard shows subject-by-subject performance over time, averages, strongest/weakest subjects, goals, attendance (attended/missed/percentage/calendar), programs, teacher/schedule/pricing basis/lessons remaining/expiry, illustrated subject cards and PDF progress report.
- [ ] Student portal includes lessons/calendar, quizzes/homework, shared resources, class chats, Community, Q&A, Academy courses, project inquiries, administrator-granted course/resource access and profile/settings; it has no checkout or payment/receipt history.
- [ ] Parent portal selects linked children; provides child dashboard/subjects/courses, monthly/term PDF reports, WhatsApp teacher contact and control to disable child's community access; it has no payment or receipt records.
- [ ] Teacher portal shows lessons and WhatsApp inquiry counts for the teacher's own listings; class/pricing management; student rosters, attendance (auto-mark on joining live class and correctable), scores, homework marking and progress notes; restricted material uploads with title/details and per-class/student access; group chats and class reports; and seller-issued receipt creation/downloads for externally confirmed sales. It has no online payment requests, payment status, earnings, commission, payout or paid-badge purchase tools.
- [ ] Quizzes, past papers, homework upload/marking, materials, Q&A, streaks, badges, optional leaderboards, goals, completed-lesson reviews/ratings and in-app/email notifications are represented in the learning tools. WhatsApp is click-to-chat only, not automated messaging.
- [ ] CBE Junior/Senior use configurable 8-level EE1–BE2 scale with supplied default percentage ranges/points; 8-4-4 uses configurable KCSE 12-point scale, per-subject boundaries, projected mean from best 7 (2 compulsory plus best 5). Label all platform scores “Lexify tutoring assessment,” never official national results; allow separate external KJSEA/KCSE/KCBE/KSSEA results.

## Phase 7 — Branded PDF reports and documents

- [ ] Server-side A4 student progress report includes student/parent, system/level/pathway/combination/term/report ID; every subject's illustration/title, teacher, score/rating/points/comments; progress charts; attendance/homework; CBE competencies/values and Senior community-service summary; goals/recommended focus.
- [ ] Provide attendance reports, parent monthly summaries (also auto-emailed), teacher class reports, course certificates/academy progress and admin enrolment/attendance/growth reports in PDF/CSV; provide seller-issued external-sale receipts separately, but do not generate payment histories, earnings statements or revenue/commission reports.
- [ ] PDFs are server-generated, branded, paginated and access-controlled by role/ownership. Seller receipts include the Lexify logo, unique receipt number, date, seller, item, quantity and KES totals plus a QR verification link; the public verification page omits buyer details and disclaims Lexify payment verification and tax-invoice status.

## Phase 8 — Computer Packages Academy

- [ ] Public `/academy` catalogue supports search and package/level/price filters; illustrated cards show title, illustration, level, duration, price/Free, rating and Preview tag.
- [ ] Seed draft-only placeholder courses, with no invented content or prices: Computer Fundamentals, Typing/Keyboard Skills, Word, Excel, PowerPoint, Access, Publisher, Internet and Email. Admin may add packages.
- [ ] Course page shows overview, outcomes, curriculum/modules/lessons, requirements, instructor/admin bio, reviews, free previews, informational price and Ask on WhatsApp; no on-site checkout.
- [ ] Course -> modules -> lessons; lesson types video (uploaded/embedded), rich text, PDF/Office notes, practice files, quiz and assignment. Admin reorders, schedules drip release, sets free preview, resources and estimated time.
- [ ] Private content uses type/size allowlists, resumable upload, macro warnings, private storage and signed URLs for enrolled/administrator-authorized learners. Malware scanning is not performed, per the user's latest instruction.
- [ ] Admin manages informational single/bundle/free/sale prices; publication, enrolments/progress/results/certificates/reviews and CSV/PDF exports; can grant/revoke course access. No subscription, promo-code redemption, checkout or revenue feature is in scope.
- [ ] Course player supports lesson list, video/content, completion, next/previous, resume, downloads, notes and Q&A; progress percentage/lessons/quiz/time; quizzes instant-mark/retake rules; assignment upload/feedback; continue-learning reminders.
- [ ] Certificate PDF includes logo placeholder, learner/course/date, optional score, unique ID and QR/verification page; issuance follows completion/pass-mark rules. Guests, students, parents and teachers may enrol; minors require consent and parent can see a child's enrolments.

## Phase 9 — Projects Store and secure digital delivery

- [ ] Public `/projects` grid filters by category/software/file type/grade/subject/price/difficulty/rating/free/paid-listing and sorts results; product page includes gallery, description, inclusions, software/version requirements, macro notice, licence, reviews, Ask seller and Share on WhatsApp, not a checkout button.
- [ ] Admin product form includes title, short/full rich descriptions, category/tags, required software/version, file types, optional curriculum tags, difficulty, KES price/discount/sale/free, licence, download limit/duration, cover/screenshots/watermarked preview, inclusions/requirements/instructions, draft/published/archived, featured/new, rights confirmation and SEO.
- [ ] Support Access `.accdb/.mdb`, Excel `.xlsx/.xlsm/.xls`, Publisher `.pub`, Word `.docx/.doc`, PowerPoint, PDF and ZIP, multiple files, drag/drop resumable upload, allowlist/block executable/scripts, type/size/checksum, macro detection and buyer warning; private `products` and public watermarked `product-previews` storage; version history/new-version notifications. Malware scanning is not performed, per the user's latest instruction.
- [ ] Store tools include bulk/duplicate/bundles/promo/copy link/WhatsApp/Open Graph/printable PDF catalogue, grant/revoke access, PDF/CSV sales dashboard, review moderation, copyright reporting, optional-off teacher seller feature.
- [ ] When a buyer wants a project/product, open the configured seller's WhatsApp with a prefilled item-specific inquiry and record only an aggregate handoff click. No buyer checkout, cart, promo-code redemption, Paystack/PesaPal, payment confirmation or refund workflow exists. A seller may issue a PDF receipt only after independently confirming the external sale; a click never grants access or creates a receipt. Product files remain private and downloads are allowed only after a real access grant; download links are short-lived, authorized and logged.
- [ ] Show that products are sample/reference/learning materials, require checkout academic-integrity acknowledgement and rights confirmation, personal-use/no-resale licence, and copyright concern reporting.

## Phase 10 — Materials, quizzes, homework, Q&A and group chats

- [ ] Provide protected materials library, quizzes, homework upload/marking, Q&A board and in-site teacher/admin group chats.
- [ ] Group chat supports membership add/remove, text, image/file sharing, replies, timestamps, read/unread, typing indicator, mute, announcement-only mode and reporting. RLS permits reading messages only to group members.

## Phase 11 — Admin panel, analytics and settings

- [ ] `/admin` includes operational overview (users/active teachers/enrolments/signups and aggregate WhatsApp handoff clicks), seller-issued receipt counts and management, user search/view/suspend/delete, teacher profile review/suspension, protected platform WhatsApp contact settings, Curriculum Manager, Course Manager, Products Manager, moderation queue/tools/channels/announcements, and non-financial PDF/CSV reports. It contains no online transaction/provider/commission/refund/payout/payment-provider controls; receipts remain manually seller-reported external-sale records.
- [ ] All settings and edits are authorized, logged, auditable, reflected across dependent public and portal views, and protected by RLS/server checks.

## Phase 12 — Community and child safety

- [ ] Build one Lexify Community with admin-managed interest channels (#general, #football, #music, #art, #coding, #movies, #gaming, #study-help), channel list/feed/member panel, dark/light mode, reactions, replies, images, nicknames, avatars and role tags; support optional leisure-hours schedule.
- [ ] Parents can disable child's community access; consent and rules acceptance are required before joining. No private messages between strangers; only public channels and teacher-run groups.
- [ ] Each message supports report; moderators can delete/mute/timeout/ban; moderation queue, profanity and phone/email/link filters, rate limits and complete moderation audit log.

## Phase 13 — Polish, performance, security, demo data and documentation

- [ ] Meet mobile-first, low-bandwidth design: compressed/lazy images, minimal JavaScript on public pages, mid-range Android performance, WCAG AA contrast/keyboard semantics, simple English and future localization structure, paginated lists/chat history, dark mode and log/error-monitor hooks.
- [ ] Validate inputs; protect against XSS/CSRF/injection; rate-limit login/signup/chat/download/PDF; enforce file allowlists/size limits/resumable uploads and macro warnings (files are not malware-scanned); parental consent, account deletion/data export, Terms/Privacy/Child-Safety. Do not implement payment endpoints or webhooks.
- [ ] Deliver README setup/deployment/Vercel guidance, WhatsApp seller-contact setup, the 100 MiB upload cap and no-scanning disclosure, curriculum assumptions to verify (Junior 9-area/merged areas, Senior core/PE status, KCSE groups/boundaries, CBE 8-level ranges), Supabase migrations/RLS/storage rules/functions/seed, admin setup SQL, and `.env.example`.
- [ ] Include sample generated progress report, course certificate and seller-issued receipt PDFs; receipt sample must contain no real buyer personal information.

## Acceptance checks from the master brief, updated for the payment-free WhatsApp and seller-receipt scope

- [ ] A Grade 8 student signs up, sees the 9 Junior School learning areas as illustrated cards, chooses a Religious Education type, and finishes with a correct list.
- [ ] A Grade 10 student picks STEM and 3 valid electives and sees 7 subjects; General Science with Biology, two Religious Education subjects, STEM mixed with Business Studies, and Kenya Sign Language for a non-deaf learner are blocked with clear messages.
- [ ] A Form 4 student picks KCSE subjects and the system enforces 7–9 subjects, all Group I, at least 2 Group II, at least 1 Group III and at least 1 other.
- [ ] A guest signs up with minimal details, can ask about an Academy course through seller WhatsApp, completes available lessons and a quiz, receives a PDF certificate when eligible, and downloads an authorized practice file; the seller may issue a separate receipt only after confirming an external sale, and Lexify does not process payment.
- [ ] Admin creates a course with modules/video/notes/practice files, sets informational price/bundle details, and publishes it without code changes.
- [ ] Admin uploads Access/Excel/Publisher/Word products with details/prices; a buyer is redirected to the seller's WhatsApp to arrange the purchase; a handoff click is counted without claiming a message or sale; the seller may later issue a PDF receipt after independently confirming the external sale, with no on-site payment taken.
- [ ] A teacher creates a Grade 10 Chemistry class; a parent can open WhatsApp with a prefilled class inquiry; the click is counted as a handoff only, and the teacher can issue a seller-generated receipt only after confirming an external sale; no payment is processed by Lexify.
- [ ] Dashboards/PDFs show each subject illustration/title and correct CBE or KCSE scale.
- [ ] Admin edits a subject/illustration/rule/level status (e.g. activates Grade 11) in Curriculum Manager and the change appears throughout the site.
- [ ] RLS prevents a student reading another student's data or admin pages; non-admin receives “Page not found” at `/admin`.


## Current request — teacher signup, profiles, Admin course files and progress charts (2026-11-25)

- [ ] Teacher account creation completes through Supabase Auth email verification and recoverable profile setup. Diagnose and correct the actual teacher signup failure; do not report success before Auth and required profile/subject writes finish. If verification succeeds but a follow-up setup write fails, sign-in must provide a safe retry path that uses the verified account and does not require duplicate signup. Keep all account roles' verification and authorization rules intact.
- [ ] Admin Course Manager can create and publish new courses, including coding and computer packages, and set informational prices in KES. Keep checkout and on-site payment collection absent; retain existing WhatsApp seller handoffs and seller-issued receipt requirements.
- [x] Admin Content Manager attaches PDF, Word, Excel, PowerPoint, text, CSV, and image files to course lessons. Files upload directly to private Storage, use an Admin-owned object path and active-account RLS policies, are capped at 100 MiB, receive MIME/extension/signature checks, and are not malware-scanned. Learners and confirmed parents receive only authorized, short-lived download links.
- [ ] Admin can publish subject- and grade-linked revision materials. Use actual live curriculum subjects/grades, private storage, MIME/extension/size/magic-byte validation, a maximum file size of 100 MiB, role and ownership enforcement, RLS and an authorized short-lived download route. A published resource is available in a student's profile only when its grade and subject match that student's recorded choices; a parent may access only for a confirmed linked child. Do not create a public file URL. The user explicitly declined malware scanning; do not claim files are scanned.
- [ ] Every account role (student, parent, teacher and guest) can update a private profile picture, bio and optional profile details; parent profile/signup supports the parent's WhatsApp number and Auth email and allows the parent to paste the student ID displayed in each student's profile. Keep parent forms free of grade, class and student-curriculum fields. A parent link request remains pending until the student confirms it.
- [x] Maintain the signed-in Supabase session when users navigate Home and other sections; sign out only on an explicit user action. Show the signed-in user's profile picture at the upper-right of the landing-page/shared header and open that role's workspace when selected; keep an accessible fallback when no picture exists.
- [x] Replace the logo's outside white background with transparency so only the circular seal is visible. Preserve white areas inside the seal and preserve the original asset; restore the “Lexify School” wordmark beside the circular header seal and update the site's logo uses consistently.
- [ ] Provide graphical progress analysis for student, parent, teacher, guest and Admin using only real, authorized records. Student charts use actual subject assessments/attendance; parent charts are scoped to confirmed children; teacher charts are scoped to owned classes; guest charts use actual course progress; Admin charts show actual platform aggregate data. Label metrics and denominators accurately and show empty states instead of invented or misleading data.
- [ ] Teacher/admin course-material uploads enforce the 100 MiB per-file limit, authenticated role checks, private storage, and MIME/extension/signature validation. Malware scanning is not required per the user's latest instruction; disclose that uploaded files are not malware-scanned.

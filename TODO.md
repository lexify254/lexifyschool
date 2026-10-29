# Lexify School — Delivery Checklist

Scope follows `lexifyschool.md` (Master Build Prompt, Version 3), which replaces earlier Lexify briefs. Keep this list aligned with the numbered phases in that brief; do not mark externally dependent integrations complete until they are configured and verified.

## Scope change from the user (2026-10-28 and 2026-10-29)

- Payment processing remains excluded. Do not build or expose gateways, on-site checkout, webhooks, payment credentials/status, refunds, commissions, payment ledgers, or payouts.
- Route seller inquiries and purchase questions to the seller's WhatsApp number using a safe `https://wa.me/<digits>?text=<encoded message>` destination. Record aggregate outbound handoff clicks by listing/seller only; label them as clicks, not unique people, sent messages, received inquiries, sales, or payments. Do not store the clicker's name, phone, message content, or raw IP.
- After a seller manually confirms a sale arranged outside Lexify School, allow that seller to issue a downloadable PDF receipt with the Lexify School logo, a unique receipt number, issue date, seller, item/description, quantity, unit price/total in KES, optional buyer name, and a QR link to public verification. The receipt is seller-reported, not a Lexify-verified payment or tax invoice; no click automatically creates a receipt. The public QR page must not expose buyer name/contact details.

## Delivered milestone — landing page and role routes

- [x] Create the Lexify School landing page from the supplied reference, with public navigation, a student-learning hero, calls to action, curriculum/computer-package categories, Why Lexify, community, and account creation sections.
- [x] Create page routes for Admin, Student, Parent, Teacher, and Guest. Protect the Admin area with a server-side role check and show a not-found response to non-admin visitors.

## Phase 1 — Project setup, Supabase schema, authentication and roles

- [x] Use Next.js App Router, React, TypeScript and Tailwind; use Supabase Postgres, Auth, Storage, Realtime, RLS and Edge Functions/server routes. Provide Vercel-compatible deployment instructions.
- [ ] Implement roles `student`, `parent`, `teacher`, `guest`, `admin`; signup offers only Student, Parent, Teacher or Guest. Admin is created manually with a SQL seed/setup script.
- [ ] Login redirects student to `/student/dashboard`, parent to `/parent/dashboard`, teacher to `/teacher/dashboard`, guest to `/guest/dashboard`, and admin to `/admin`.
- [ ] Enforce authorization on the server and in database RLS, not only by hiding UI. A non-admin who opens `/admin` receives a plain 404; include login rate limiting and Supabase MFA support for admin.
- [x] Block suspended accounts in protected server pages/APIs and authenticated public-schema/Storage RLS policies; preserve each user's own profile-status read so the suspension notice still works.
- [ ] Include verification, password reset, international-format Kenyan phone normalization (+2547...), secure avatar upload, validation, friendly onboarding progress and guest upgrade to student/parent while preserving course access and learning progress.
- [x] Create `.env.example` with Supabase, WhatsApp contact, email and malware-scan settings; never commit secrets.

## Phase 2 — Curriculum schema, seed data, illustrations and Curriculum Manager

- [ ] Store education systems, levels and statuses in database tables with `is_active`, `starts_on`, `ends_on`; admins can activate/deactivate and schedule levels without code changes.
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

- [ ] Student signup collects full name, picture, system/level, subject choices, guardian name, guardian phone and WhatsApp, optional student WhatsApp, email or phone, password or OTP option, parental-consent checkbox, and optional school/county/goals/lesson times/hobbies. Show compulsory illustrated cards, guided required choices, live rule validation, final review and confirmation.
- [ ] Junior student chooses CRE/IRE/HRE, Kiswahili or KSL only if deaf, and optional extra tutoring subjects.
- [ ] Senior student chooses pathway/track and exactly three valid electives subject to stored rules; show clear invalid-choice messages.
- [ ] 8-4-4 student chooses KCSE subjects subject to Group I–V rules.
- [ ] Teacher signup collects name, photo, WhatsApp, mobile, email and password, then profile bio, curriculum-backed systems/levels/subjects taught, self-declared experience, optional qualifications, classes and pricing. No national ID or TSC number is required.
- [ ] Parent signup collects name, optional picture, phone, WhatsApp, email and password, then links/confirms one or more children.
- [ ] Guest signup stays light: name, email or phone, password, optional WhatsApp/photo, and consent checkbox “I am 18 or older, or my parent/guardian has given consent.” No grade/pathway/guardian fields; after signup go to Computer Packages Academy.

## Phase 4 — Public pages, teacher marketplace and WhatsApp

- [ ] Build public Home, teacher/subject browse, teacher profile, `/academy`, `/projects`, curriculum guide/pathway helper, how-it-works/pricing, About, Contact, Terms, Privacy, Child-Safety, signup and login pages.
- [ ] Public Home includes hero, how it works, Junior/Senior/8-4-4/Computer Packages/Projects categories, featured teachers and testimonials.
- [ ] Teacher browse filters by education category, level, pathway, illustrated subject, price, pricing basis and rating; display verified badge.
- [ ] Teacher profile shows photo, bio, illustrated subjects, price/pricing basis, reviews, verified badge, Chat on WhatsApp and inquiry actions.
- [ ] Teachers can define classes with category, level, subject/strand, schedule, meeting link, capacity and informational price; pricing basis per class is lesson bundle of N, weekly or monthly.
- [ ] WhatsApp click-to-chat uses the normalized signup number in `https://wa.me/<digits>?text=<encoded message>`, with useful prefilled class/subject messages, buttons rather than raw phone numbers, and clear note that click-to-chat URLs necessarily contain the number. Add links on teacher, class, booking/enrolment, parent/teacher lists, course and product pages.

## Phase 5 — Seller WhatsApp handoff (payment processing excluded)

- [x] Class booking, course enrolment inquiry, and project/product purchase actions open the relevant seller's WhatsApp with a clear prefilled item-specific message.
- [x] Normalize and validate the seller's WhatsApp number before creating `wa.me` links; if no valid number is configured, show a clear contact-unavailable message instead of a dead button.
- [x] Configure `WHATSAPP_ADMIN_NUMBER` for project/store inquiries through secure project settings; the value is present for all environments and passes the app's Kenyan phone-format check. The number itself is not committed to the repository.
- [x] Count each same-origin seller WhatsApp handoff by published item and seller; show totals to administrators and the owning teacher. State clearly that the total measures outbound link clicks only, not unique people, messages, bookings, or purchases; store no clicker name, phone, message text, or raw IP.
- [x] After manually confirming an externally arranged sale, let an authorized teacher or administrator create and download a seller-issued receipt; never generate one from a WhatsApp click. Preserve the payment-free scope: do not create an on-site checkout, payment status, payment credentials, commission, payout, or refund workflow.

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
- [ ] Private content uses type/size allowlist, resumable upload, malware scan, macro warnings, private storage and signed URLs for enrolled/administrator-authorized learners.
- [ ] Admin manages informational single/bundle/free/sale prices; publication, enrolments/progress/results/certificates/reviews and CSV/PDF exports; can grant/revoke course access. No subscription, promo-code redemption, checkout or revenue feature is in scope.
- [ ] Course player supports lesson list, video/content, completion, next/previous, resume, downloads, notes and Q&A; progress percentage/lessons/quiz/time; quizzes instant-mark/retake rules; assignment upload/feedback; continue-learning reminders.
- [ ] Certificate PDF includes logo placeholder, learner/course/date, optional score, unique ID and QR/verification page; issuance follows completion/pass-mark rules. Guests, students, parents and teachers may enrol; minors require consent and parent can see a child's enrolments.

## Phase 9 — Projects Store and secure digital delivery

- [ ] Public `/projects` grid filters by category/software/file type/grade/subject/price/difficulty/rating/free/paid-listing and sorts results; product page includes gallery, description, inclusions, software/version requirements, macro notice, licence, reviews, Ask seller and Share on WhatsApp, not a checkout button.
- [ ] Admin product form includes title, short/full rich descriptions, category/tags, required software/version, file types, optional curriculum tags, difficulty, KES price/discount/sale/free, licence, download limit/duration, cover/screenshots/watermarked preview, inclusions/requirements/instructions, draft/published/archived, featured/new, rights confirmation and SEO.
- [ ] Support Access `.accdb/.mdb`, Excel `.xlsx/.xlsm/.xls`, Publisher `.pub`, Word `.docx/.doc`, PowerPoint, PDF and ZIP, multiple files, drag/drop resumable upload, allowlist/block executable/scripts, type/size/checksum, malware scan, macro detection and buyer warning; private `products` and public watermarked `product-previews` storage; version history/new-version notifications.
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
- [ ] Validate inputs; protect against XSS/CSRF/injection; rate-limit login/signup/chat/download/PDF; secure file allowlists/size limits/resumable uploads/malware/macro checks; parental consent, account deletion/data export, Terms/Privacy/Child-Safety. Do not implement payment endpoints or webhooks.
- [ ] Deliver README setup/deployment/Vercel guidance, WhatsApp seller-contact setup, upload limits/scanning setup, curriculum assumptions to verify (Junior 9-area/merged areas, Senior core/PE status, KCSE groups/boundaries, CBE 8-level ranges), Supabase migrations/RLS/storage rules/functions/seed, admin setup SQL, and `.env.example`.
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

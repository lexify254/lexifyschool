"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { normalizeKenyanPhone } from "@/lib/whatsapp/links";
import { SubjectCard } from "@/components/subject-card";
import {
  classifyCurriculumSystem,
  validateEightFourFourSelection,
  validateJuniorSelection,
  validateSeniorSelection,
  type CurriculumSubject,
  type CurriculumRuleConfig,
  type SeniorPathway,
} from "@/lib/curriculum/rules";

type Role = "student" | "parent" | "teacher" | "guest";
type Row = Record<string, any>;
type Catalogue = { systems: Row[]; grades: Row[]; pathways: Row[]; tracks: Row[]; areas: Row[]; links: Row[]; groups: Row[]; rules: Row[] };
const roleDestinations: Record<Role, string> = {
  student: "/student/dashboard", parent: "/parent/dashboard", teacher: "/teacher/dashboard", guest: "/guest/dashboard",
};
const roleLabels: Record<Role, string> = { student: "Student", parent: "Parent", teacher: "Teacher", guest: "Guest" };
const blankCatalogue: Catalogue = { systems: [], grades: [], pathways: [], tracks: [], areas: [], links: [], groups: [], rules: [] };
const plainError = (error: unknown, fallback: string) => {
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return text ? text.replace(/\s+/g, " ").slice(0, 260) : fallback;
};
const text = (value: unknown) => String(value ?? "").trim();
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function RoleChooser({ issue }: { issue?: string }) {
  const descriptions: Record<Role, string> = {
    student: "Choose your learning level, curriculum and subjects.",
    parent: "Stay connected to a learner and request a parent link.",
    teacher: "Share your teaching subjects and experience.",
    guest: "Explore Lexify School with a basic account.",
  };
  const recoveryMessages: Record<string, string> = {
    curriculum_pending: "Your email was verified, but curriculum or learner profile details were not saved. Sign in and complete setup before relying on your subject selection.",
    teacher_subjects_pending: "Your email was verified, but teaching subjects or teacher details were not saved. Sign in and complete your profile.",
    parent_link_pending: "Your email was verified, but the learner-link request was not saved. Sign in and submit the request again.",
  };
  return <main className="auth-page"><div className="container auth-layout"><section className="auth-card"><p className="eyebrow">GET STARTED</p><h1>Create your account</h1><p className="auth-card__intro">Choose how you’ll use Lexify School. You can’t register as an administrator.</p>{issue && recoveryMessages[issue] ? <div className="form-error" role="alert">{recoveryMessages[issue]} <Link href="/login">Sign in</Link></div> : null}<div className="role-grid">{(Object.keys(roleLabels) as Role[]).map((role) => <Link className="role-card" key={role} href={`/signup/${role}`}><span className="role-card__icon" aria-hidden="true">{role === "student" ? "S" : role === "parent" ? "P" : role === "teacher" ? "T" : "G"}</span><h2>{roleLabels[role]}</h2><p>{descriptions[role]}</p></Link>)}</div><p className="auth-card__intro" style={{ marginTop: 22 }}>Already have an account? <Link href="/login">Sign in</Link></p></section><aside className="auth-card"><h2>Safe, supported learning</h2><p className="auth-card__intro">We only ask for the information needed to set up your account. Learner subject choices are checked against the active catalogue and curriculum rules.</p></aside></div></main>;
}

async function loadCatalogue(client: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>): Promise<Catalogue> {
  const [systems, grades, pathways, tracks, areas, links, groups, rules] = await Promise.all([
    client.from("education_systems").select("id,code,name,is_active").eq("is_active", true).order("name").limit(30),
    client.from("grades").select("id,system_id,code,name,level_order,is_active").order("level_order").limit(100),
    client.from("pathways").select("id,system_id,code,name,is_active,sort_order").eq("is_active", true).order("sort_order").limit(30),
    client.from("pathway_tracks").select("id,pathway_id,code,name,is_active,sort_order").eq("is_active", true).order("sort_order").limit(60),
    client.from("learning_areas").select("id,system_id,code,kcse_code,title,description,is_core,is_examinable,is_active,icon_name,accent_color,is_optional_activity,restriction_code,pathway_id,track_id,group_id,parent_area_id,sort_order").eq("is_active", true).order("sort_order").limit(500),
    client.from("grade_learning_areas").select("grade_id,learning_area_id,role,is_required,sort_order").order("sort_order").limit(1000),
    client.from("subject_groups").select("id,code,name").limit(100),
    client.from("combination_rules").select("system_id,applies_from_grade_id,code,rule_json,is_enabled,is_warning_only").eq("is_enabled", true).eq("is_warning_only", false).limit(100),
  ]);
  const failed = [systems, grades, pathways, tracks, areas, links, groups, rules].find((result) => result.error);
  if (failed?.error) throw new Error("We could not load the live curriculum catalogue. Please try again later.");
  if (!systems.data?.length || !grades.data?.length || !areas.data?.length || !links.data?.length) throw new Error("The curriculum catalogue is not ready. Please try again later.");
  return { systems: systems.data, grades: grades.data, pathways: pathways.data ?? [], tracks: tracks.data ?? [], areas: areas.data, links: links.data, groups: groups.data ?? [], rules: rules.data ?? [] };
}

function subjectsForGrade(catalogue: Catalogue, gradeId: string): Row[] {
  const ids = new Set(catalogue.links.filter((item) => item.grade_id === gradeId).map((item) => item.learning_area_id));
  return catalogue.areas.filter((area) => ids.has(area.id));
}
function curriculumRecords(rows: Row[], catalogue: Catalogue): CurriculumSubject[] {
  const groupById = new Map(catalogue.groups.map((item) => [item.id, item.code ?? item.name]));
  const pathById = new Map(catalogue.pathways.map((item) => [item.id, item.name]));
  const trackById = new Map(catalogue.tracks.map((item) => [item.id, item.name]));
  const areaById = new Map(catalogue.areas.map((item) => [item.id, item]));
  const parentIds = new Set(catalogue.areas.filter((item) => item.parent_area_id).map((item) => item.parent_area_id));
  return rows.map((row) => {
    const parent = row.parent_area_id ? areaById.get(row.parent_area_id) : undefined;
    const baseArea = parent?.title ?? row.title;
    const title = row.title as string;
    return {
      id: row.id, name: title, title, label: title, code: row.code, kcseCode: row.kcse_code, curriculumArea: baseArea,
      parentAreaId: row.parent_area_id ?? undefined, isAreaContainer: parentIds.has(row.id),
      area: baseArea, group: groupById.get(row.group_id) ?? undefined,
      pathway: row.pathway_id ? pathById.get(row.pathway_id) : undefined,
      track: row.track_id ? trackById.get(row.track_id) : undefined,
      isCore: row.is_core, isReligiousEducation: /\b(CRE|IRE|HRE|religious education)\b/i.test(`${row.code} ${title}`),
      isKenyaSignLanguage: /sign language|\bksl\b/i.test(`${row.code} ${title}`),
      requiresDeafLearner: row.restriction_code === "DEAF_LEARNER_ONLY",
      overlapsWith: [],
    } satisfies CurriculumSubject;
  });
}
function ruleConfig(catalogue: Catalogue, curriculum: CurriculumSubject[], systemId: string, gradeId: string): CurriculumRuleConfig | undefined {
  const byCode = new Map(curriculum.map((item) => [item.code, item.id]));
  const gradeOrder = Number(catalogue.grades.find((item) => item.id === gradeId)?.level_order ?? 0);
  const overlapSets: { ids: (string | number)[] }[][] = [];
  for (const rule of catalogue.rules.filter((item) => item.system_id === systemId && (!item.applies_from_grade_id || Number(catalogue.grades.find((grade) => grade.id === item.applies_from_grade_id)?.level_order ?? 0) <= gradeOrder))) {
    const data = rule.rule_json;
    const exclusions = ["overlap_pairs", "exclusions", "blocked_pairs", "incompatible_pairs"]
      .flatMap((key) => Array.isArray(data?.[key]) ? data[key] : []);
    for (const set of exclusions) {
      if (!Array.isArray(set)) continue;
      const ids = set.map((code: string) => byCode.get(code)).filter((id: string | number | undefined): id is string | number => id !== undefined);
      if (ids.length > 1) overlapSets.push(ids.map((id) => ({ ids: [id] })));
    }
  }
  return overlapSets.length ? { senior: { overlappingSubjectSets: overlapSets } } : undefined;
}

export function SignupForm({ role: requestedRole }: { role: string }) {
  const router = useRouter();
  const role: Role = ["student", "parent", "teacher", "guest"].includes(requestedRole) ? requestedRole as Role : "guest";
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [catalogue, setCatalogue] = useState<Catalogue>(blankCatalogue);
  const [catalogueError, setCatalogueError] = useState("");
  const [loadingCatalogue, setLoadingCatalogue] = useState(role === "student" || role === "teacher");
  const [systemId, setSystemId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [pathwayId, setPathwayId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [optionalAreas, setOptionalAreas] = useState<string[]>([]);
  const [religionId, setReligionId] = useState("");
  const [languageId, setLanguageId] = useState("");
  const [teacherPairs, setTeacherPairs] = useState<{ gradeId: string; areaId: string }[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recoverable, setRecoverable] = useState(false);
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [otpSent, setOtpSent] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [phoneForOtp, setPhoneForOtp] = useState("");
  const [pendingSignupMetadata, setPendingSignupMetadata] = useState<Row>({});
  const [pendingParentStudentId, setPendingParentStudentId] = useState("");

  useEffect(() => {
    if (role !== "student" && role !== "teacher") return;
    if (!client) { setLoadingCatalogue(false); setCatalogueError("Account services are not configured, so the live curriculum is unavailable."); return; }
    let active = true;
    loadCatalogue(client).then((data) => { if (active) { setCatalogue(data); setCatalogueError(""); } }).catch((e) => { if (active) setCatalogueError(plainError(e, "Could not load the live curriculum.")); }).finally(() => { if (active) setLoadingCatalogue(false); });
    return () => { active = false; };
  }, [client, role]);

  const availableGrades = catalogue.grades.filter((item) => !systemId || item.system_id === systemId);
  const grade = catalogue.grades.find((item) => item.id === gradeId);
  const system = catalogue.systems.find((item) => item.id === (grade?.system_id ?? systemId));
  const gradeRows = grade ? subjectsForGrade(catalogue, gradeId) : [];
  const pathway = catalogue.pathways.find((item) => item.id === pathwayId);
  const tracks = catalogue.tracks.filter((item) => item.pathway_id === pathwayId);
  const curriculumKind = classifyCurriculumSystem(system ?? {}, grade ?? undefined);
  const senior = curriculumKind === "senior";
  const junior = curriculumKind === "junior";
  const kcse = curriculumKind === "kcse";
  const currentRecords = curriculumRecords(gradeRows, catalogue);
  const validation = useMemo(() => {
    if (role !== "student" || !grade || !gradeRows.length) return null;
    if (junior) {
      const selected = [...selectedAreas, ...(languageId ? [languageId] : []), ...(religionId ? [religionId] : []), ...optionalAreas];
      return validateJuniorSelection({ grade: Number(grade.level_order), catalog: currentRecords, selected, config: undefined });
    }
    if (senior) return validateSeniorSelection({ grade: Number(grade.level_order), catalog: currentRecords, selected: selectedAreas, pathway: pathway?.name as SeniorPathway | undefined, track: tracks.find((item) => item.id === trackId)?.name, config: ruleConfig(catalogue, currentRecords, systemId || system?.id || "", gradeId) });
    if (kcse) return validateEightFourFourSelection({ form: /(?:^|\D)3(?:\D|$)|f3/i.test(`${grade.code} ${grade.name}`) ? 3 : 4, catalog: currentRecords, selected: selectedAreas });
    return null;
  }, [role, grade, gradeRows, junior, senior, kcse, selectedAreas, optionalAreas, languageId, religionId, currentRecords, pathway, tracks, trackId, catalogue, systemId, system, gradeId]);
  const valid844Math = !kcse || selectedAreas.filter((id) => gradeRows.some((item) => item.id === id && ["121", "122"].includes(String(item.kcse_code ?? "").trim()))).length === 1;

  function toggle(values: string[], set: (next: string[]) => void, id: string) { set(values.includes(id) ? values.filter((item) => item !== id) : [...values, id]); }
  function chooseGrade(id: string) {
    setGradeId(id); setOptionalAreas([]); setReligionId(""); setLanguageId(""); setPathwayId(""); setTrackId("");
    const selectedGrade = catalogue.grades.find((item) => item.id === id);
    if (selectedGrade && classifyCurriculumSystem(catalogue.systems.find((item) => item.id === selectedGrade.system_id) ?? {}, selectedGrade) === "junior") {
      const required = catalogue.links.filter((item) => item.grade_id === id && item.role === "core" && item.is_required).map((item) => item.learning_area_id);
      setSelectedAreas(catalogue.areas.filter((item) => required.includes(item.id) && !item.parent_area_id && !item.is_optional_activity).map((item) => item.id));
    } else setSelectedAreas([]);
  }
  function selectedIds(): string[] {
    if (role === "student" && senior && grade) {
      const result = validateSeniorSelection({ grade: Number(grade.level_order), catalog: currentRecords, selected: selectedAreas, pathway: pathway?.name as SeniorPathway | undefined, track: tracks.find((item) => item.id === trackId)?.name, config: ruleConfig(catalogue, currentRecords, systemId || system?.id || "", gradeId) });
      return result.subjectIds.map(String);
    }
    return role === "student" ? junior ? [...selectedAreas, ...(languageId ? [languageId] : []), ...(religionId ? [religionId] : []), ...optionalAreas] : [...selectedAreas, ...optionalAreas] : [];
  }

  async function finalizeAuthenticatedUser(userId: string, userRole: Role, subjectPayload?: { gradeId: string; ids: string[]; pathwayId?: string; trackId?: string }, signupMetadata: Row = {}, parentStudentId = "") {
    if (!client) throw new Error("Account services are unavailable; profile setup could not be saved.");
    if (userRole === "student" && subjectPayload) {
      const { data, error: rpcError } = await client.rpc("save_student_subjects", {
        grade_id: subjectPayload.gradeId,
        selected_area_ids: subjectPayload.ids,
        pathway_id: subjectPayload.pathwayId ?? null,
        track_id: subjectPayload.trackId ?? null,
      });
      if (rpcError || data?.saved !== true) throw new Error(plainError(rpcError, "Supabase did not confirm that your curriculum selection was saved. Please review it and try again."));
      const optionalDetails: Row = {};
      for (const field of ["school", "county", "goals"] as const) {
        const value = text(signupMetadata[field]);
        if (value) optionalDetails[field] = value;
      }
      const hobbies = Array.isArray(signupMetadata.hobbies)
        ? signupMetadata.hobbies.filter((item: unknown): item is string => typeof item === "string").map((item: string) => item.trim()).filter(Boolean)
        : [];
      if (hobbies.length) optionalDetails.hobbies = hobbies;
      if (Object.keys(optionalDetails).length) {
        const { data: savedDetails, error: detailError } = await client.from("student_details").update(optionalDetails).eq("profile_id", userId).select("profile_id").maybeSingle();
        if (detailError || !savedDetails) throw new Error(`Learner profile details were not saved: ${plainError(detailError, "the profile row was not found")}.`);
      }
    }
    if (userRole === "teacher") {
      const rows = teacherPairs.map((item) => ({ teacher_id: userId, grade_id: item.gradeId, learning_area_id: item.areaId }));
      if (rows.length) {
        const { data: savedSubjects, error: teacherError } = await client.from("teacher_subjects").upsert(rows, { onConflict: "teacher_id,grade_id,learning_area_id" }).select("id");
        if (teacherError || savedSubjects?.length !== rows.length) throw new Error(`Teaching subjects were not saved: ${plainError(teacherError, "Supabase did not confirm every selected subject")}.`);
      }
      const firstSelection = Array.isArray(signupMetadata.pending_subject_selection) ? signupMetadata.pending_subject_selection[0] : null;
      const exp = firstSelection && typeof firstSelection.experience_years === "number" ? firstSelection.experience_years : null;
      const qualifications = firstSelection && Array.isArray(firstSelection.qualifications) ? firstSelection.qualifications.filter((item: unknown): item is string => typeof item === "string") : [];
      const publicWhatsapp = typeof signupMetadata.whatsapp === "string" ? signupMetadata.whatsapp : "";
      if (exp !== null || qualifications.length || publicWhatsapp) {
        const updates: Row = {};
        if (exp !== null) updates.experience_years = exp;
        if (qualifications.length) updates.qualifications = qualifications;
        if (publicWhatsapp) updates.public_whatsapp = publicWhatsapp;
        const { data: savedDetails, error: detailError } = await client.from("teacher_details").update(updates).eq("profile_id", userId).select("profile_id").maybeSingle();
        if (detailError || !savedDetails) throw new Error(`Teacher details were not saved: ${plainError(detailError, "the teacher profile row was not found")}.`);
      }
    }
    if (userRole === "parent") {
      const childId = parentStudentId || (document.getElementById("childProfileId") as HTMLInputElement | null)?.value.trim() || "";
      if (childId) {
        const { data: link, error: linkError } = await client.from("parent_student_links").insert({ parent_id: userId, student_id: childId, relationship: "parent/guardian" }).select("id").maybeSingle();
        if (linkError || !link) throw new Error(`The parent-link request was not saved: ${plainError(linkError, "Supabase did not confirm the request")}.`);
      }
    }
    if (userRole === "student" || userRole === "teacher") {
      const { error: metadataError } = await client.auth.updateUser({ data: { pending_subject_selection: null } });
      if (metadataError) throw new Error(`Your profile was saved, but signup recovery data could not be cleared: ${plainError(metadataError, "metadata update failed")}.`);
    }
    if (avatar) {
      const ext = avatar.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await client.storage.from("avatars").upload(path, avatar, { upsert: true, contentType: avatar.type || "image/jpeg" });
      if (uploadError) throw new Error(`Your profile picture was not uploaded: ${plainError(uploadError, "storage is unavailable")}.`);
      const { data } = client.storage.from("avatars").getPublicUrl(path);
      const { data: savedProfile, error: profileError } = await client.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId).select("id").maybeSingle();
      if (profileError || !savedProfile) throw new Error(`Your profile picture URL was not saved: ${plainError(profileError, "the profile row was not found")}.`);
      if (userRole === "teacher") {
        const { data: savedTeacher, error: teacherError } = await client.from("teacher_details").update({ public_avatar_url: data.publicUrl }).eq("profile_id", userId).select("profile_id").maybeSingle();
        if (teacherError || !savedTeacher) throw new Error(`Your teacher profile picture was not saved: ${plainError(teacherError, "the teacher profile row was not found")}.`);
      }
    }
  }

  async function processEmailSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setRecoverable(false);
    if (!client) { setError("Account services are not configured. Please contact support."); return; }
    const form = new FormData(event.currentTarget);
    const fullName = text(form.get("fullName"));
    const email = text(form.get("email"));
    const password = text(form.get("password"));
    const rawPhone = text(form.get("phone"));
    const phoneDigits = rawPhone ? normalizeKenyanPhone(rawPhone) : null;
    const phone = phoneDigits ? `+${phoneDigits}` : "";
    const rawWhatsapp = text(form.get("whatsapp"));
    const whatsappDigits = rawWhatsapp ? normalizeKenyanPhone(rawWhatsapp) : null;
    const whatsapp = whatsappDigits ? `+${whatsappDigits}` : "";
    const rawGuardianPhone = text(form.get("guardianPhone"));
    const guardianPhoneDigits = rawGuardianPhone ? normalizeKenyanPhone(rawGuardianPhone) : null;
    const guardianPhone = guardianPhoneDigits ? `+${guardianPhoneDigits}` : "";
    const rawGuardianWhatsapp = text(form.get("guardianWhatsApp"));
    const guardianWhatsappDigits = rawGuardianWhatsapp ? normalizeKenyanPhone(rawGuardianWhatsapp) : null;
    const guardianWhatsapp = guardianWhatsappDigits ? `+${guardianWhatsappDigits}` : "";
    if (!fullName) { setError("Enter your full name."); return; }
    if ((role === "parent" || role === "teacher" || method === "phone") && !phone) { setError("Enter a valid Kenyan mobile number in +254 format."); return; }
    if (rawPhone && !phone) { setError("Enter a valid Kenyan mobile number, such as +254712345678."); return; }
    if (rawWhatsapp && !whatsapp) { setError("Enter a valid Kenyan WhatsApp number, such as +254712345678."); return; }
    if (rawGuardianPhone && !guardianPhone) { setError("Enter a valid Kenyan guardian phone number in +254 format."); return; }
    if (rawGuardianWhatsapp && !guardianWhatsapp) { setError("Enter a valid Kenyan guardian WhatsApp number in +254 format."); return; }
    if (role === "student") {
      if (!catalogue || catalogueError || !grade || !grade.is_active || !system) { setError("Select an active education system and grade from the live catalogue."); return; }
      if (!validation?.valid) { setError(validation?.errors[0]?.message ?? "Complete and validate your curriculum selection before continuing."); return; }
      if (kcse && !valid844Math) { setError("Choose exactly one Group I Mathematics option: code 121 or code 122."); return; }
      if (junior && (selectedAreas.length !== 9 || !religionId || !languageId)) { setError("Choose all nine required Junior School areas, one language option, and exactly one Religious Education option."); return; }
      if (!text(form.get("guardianName")) || !guardianPhone) { setError("Enter a guardian name and a valid phone number in +254 format."); return; }
      if (!form.get("guardianConsent")) { setError("A parent or guardian’s consent is required to create a student account."); return; }
    }
    if (role === "guest" && !form.get("adultConsent")) { setError("Confirm that you are 18 or older, or that your parent or guardian has given consent."); return; }
    if (role === "teacher" && !teacherPairs.length) { setError("Choose at least one active teaching grade and subject."); return; }
    if (role === "teacher") {
      const experience = text(form.get("experience"));
      if (experience && (!Number.isInteger(Number(experience)) || Number(experience) < 0 || Number(experience) > 80)) { setError("Enter teaching experience as a whole number from 0 to 80 years."); return; }
    }
    if (role === "parent") {
      const childId = text(form.get("childProfileId"));
      if (childId && !isUuid(childId)) { setError("Enter a valid learner profile UUID or leave the field blank."); return; }
    }
    if (method === "email" && password.length < 8) { setError("Use a password with at least 8 characters."); return; }
    const ids = role === "student" ? selectedIds() : [];
    const experienceYears = role === "teacher" ? text(form.get("experience")) : "";
    const qualifications = role === "teacher" ? text(form.get("qualifications")) : "";
    const preferred = ["Weekday mornings", "Weekday afternoons", "Weekday evenings", "Weekends"].filter((label) => form.get(`time-${label}`));
    const parentStudentId = role === "parent" ? text(form.get("childProfileId")) : "";
    const hobbies = role === "student" ? text(form.get("hobbies")).split(",").map((item) => item.trim()).filter(Boolean) : [];
    const teacherQualifications = qualifications.split(",").map((item) => item.trim()).filter(Boolean);
    const metadata: Row = {
      role, full_name: fullName, phone: phone || null, whatsapp: whatsapp || null,
      education_system_id: role === "student" ? systemId : null,
      grade_id: role === "student" ? gradeId : null,
      pathway_id: role === "student" && senior ? pathwayId || null : null,
      track_id: role === "student" && senior ? trackId || null : null,
      guardian_name: role === "student" ? text(form.get("guardianName")) : null,
      guardian_phone: role === "student" ? guardianPhone : null,
      guardian_whatsapp: role === "student" ? guardianWhatsapp || null : null,
      preferred_lesson_times: preferred,
      consent_given: role === "student" ? Boolean(form.get("guardianConsent")) : false,
      consent_at: role === "student" && form.get("guardianConsent") ? new Date().toISOString() : null,
      school: role === "student" ? text(form.get("school")) || null : null,
      county: role === "student" ? text(form.get("county")) || null : null,
      goals: role === "student" ? text(form.get("goals")) || null : null,
      hobbies,
      adult_or_guardian_consent: role === "guest" ? Boolean(form.get("adultConsent")) : false,
      ...(role === "student" ? { pending_subject_selection: ids } : role === "teacher" ? { pending_subject_selection: teacherPairs.map((pair) => ({ grade_id: pair.gradeId, learning_area_id: pair.areaId, experience_years: experienceYears ? Number(experienceYears) : null, qualifications: teacherQualifications })) } : {}),
    };
    setPendingSignupMetadata(metadata);
    setPendingParentStudentId(parentStudentId);
    setWorking(true);
    let accountCreated = false;
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      if (role === "parent") {
        const childId = text(form.get("childProfileId"));
        if (childId) callbackUrl.searchParams.set("parent_student_id", childId);
      }
      const redirectTo = callbackUrl.toString();
      if (method === "phone") {
        if (!phone) throw new Error("Enter a valid Kenyan mobile number in +254 format to use SMS verification.");
        setPhoneForOtp(phone);
        const { error: otpError } = await client.auth.signInWithOtp({ phone, options: { shouldCreateUser: true, data: metadata, channel: "sms" } });
        if (otpError) throw otpError;
        accountCreated = true;
        setOtpSent(true); setNotice("A sign-in code was requested. Enter the code sent by your configured SMS provider to complete signup."); return;
      }
      const { data, error: signUpError } = await client.auth.signUp({ email, password, options: { data: metadata, emailRedirectTo: redirectTo } });
      if (signUpError) throw signUpError;
      accountCreated = Boolean(data.user);
      if (data.user?.identities?.length === 0) {
        setError("An account already uses this email address. Sign in instead of submitting signup again.");
        setRecoverable(true);
        return;
      }
      if (data.session && data.user) {
        await finalizeAuthenticatedUser(data.user.id, role, role === "student" ? { gradeId, ids, pathwayId: senior ? pathwayId : undefined, trackId: senior ? trackId : undefined } : undefined, metadata, parentStudentId);
        router.replace(roleDestinations[role]); return;
      }
      if (!data.user) throw new Error("Supabase did not return a user record for this signup request.");
      setNotice("Signup is pending email verification. Check your inbox and open the verification link. Curriculum and profile selections are submitted to Supabase after verification; your profile picture is not uploaded until you are signed in.");
    } catch (e) {
      setError(accountCreated
        ? `Supabase created your login, but profile setup did not finish: ${plainError(e, "one or more profile writes failed")}. Sign in to continue; do not submit signup again.`
        : plainError(e, "We could not complete signup. Check your details and try again."));
      if (accountCreated) setRecoverable(true);
    }
    finally { setWorking(false); }
  }

  async function verifyPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setRecoverable(false); setWorking(true);
    if (!client) { setError("Account services are not configured."); setWorking(false); return; }
    const phone = phoneForOtp;
    const token = text((document.getElementById("otp") as HTMLInputElement | null)?.value);
    if (!phone) { setError("The verification phone number is missing. Please restart signup."); setWorking(false); return; }
    let accountVerified = false;
    try {
      const { data, error: verifyError } = await client.auth.verifyOtp({ phone, token, type: "sms" });
      if (verifyError || !data.user) throw verifyError ?? new Error("That code could not be verified.");
      accountVerified = true;
      await finalizeAuthenticatedUser(data.user.id, role, role === "student" ? { gradeId, ids: selectedIds(), pathwayId: senior ? pathwayId : undefined, trackId: senior ? trackId : undefined } : undefined, pendingSignupMetadata, pendingParentStudentId);
      router.replace(roleDestinations[role]);
    } catch (e) {
      setError(accountVerified
        ? `Your phone was verified, but profile setup did not finish: ${plainError(e, "one or more profile writes failed")}. Sign in to continue; do not restart signup.`
        : `${plainError(e, "The code could not be verified.")} If SMS OTP is not enabled for this Supabase project, use email signup instead.`);
      if (accountVerified) setRecoverable(true);
    }
    finally { setWorking(false); }
  }

  const chooserDisabled = loadingCatalogue || Boolean(catalogueError) || !gradeId;
  const rolesTitle = role === "student" ? "Student account" : `${roleLabels[role]} account`;
  return <main className="auth-page"><div className="container"><section className="auth-card" style={{ maxWidth: 850, margin: "0 auto" }}>
    <p className="eyebrow">CREATE ACCOUNT · {roleLabels[role].toUpperCase()}</p><h1>{rolesTitle}</h1><p className="auth-card__intro">Enter your details. Required fields are marked; your account is not created until Supabase confirms signup.</p>
    {catalogueError && (role === "student" || role === "teacher") ? <div className="form-error" role="alert">{catalogueError} We will not accept curriculum selections without the live catalogue.</div> : null}
    {error && <div className="form-error" role="alert">{error}{recoverable ? <> <Link href="/login">Go to sign in</Link></> : null}</div>}{notice && <div className="form-success" role="status">{notice}</div>}
    {otpSent ? <form className="form-grid" onSubmit={verifyPhone}><p className="auth-card__intro">Enter the SMS code sent to {phoneForOtp}.</p><div className="form-field"><label htmlFor="otp">SMS verification code</label><input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" required /></div><button className="button button--primary" disabled={working}>{working ? "Verifying…" : "Verify code and finish signup"}</button></form> : <form className="form-grid" onSubmit={processEmailSignup}>
      <div className="form-grid form-grid--two"><div className="form-field"><label htmlFor="fullName">Full name *</label><input id="fullName" name="fullName" autoComplete="name" required maxLength={120} /></div><div className="form-field"><label htmlFor="avatar">Profile picture <span>(optional)</span></label><input id="avatar" type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} /><small>Uploaded to the public avatars bucket only after you are signed in.</small></div></div>
      <div className="form-grid form-grid--two"><div className="form-field"><label htmlFor="phone">Mobile number {method === "phone" || role === "teacher" || role === "parent" ? "*" : "(optional)"}</label><input id="phone" name="phone" type="tel" autoComplete="tel" required={method === "phone" || role === "teacher" || role === "parent"} placeholder="+254…" /></div><div className="form-field"><label htmlFor="whatsapp">WhatsApp number (optional)</label><input id="whatsapp" name="whatsapp" type="tel" placeholder="+254…" /></div></div>
      {role === "student" && <>
        <div className="form-divider"/><h2>Education and curriculum</h2>
        <div className="form-grid form-grid--two"><div className="form-field"><label htmlFor="system">Education system *</label><select id="system" value={systemId} required disabled={loadingCatalogue || Boolean(catalogueError)} onChange={(e) => { setSystemId(e.target.value); setGradeId(""); setSelectedAreas([]); setOptionalAreas([]); setReligionId(""); setLanguageId(""); setPathwayId(""); setTrackId(""); }}><option value="">Choose a system</option>{catalogue.systems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="form-field"><label htmlFor="grade">Grade / level *</label><select id="grade" value={gradeId} required disabled={!systemId || Boolean(catalogueError)} onChange={(e) => chooseGrade(e.target.value)}><option value="">Choose an active grade</option>{availableGrades.map((item) => <option key={item.id} value={item.id} disabled={!item.is_active}>{item.name}{!item.is_active ? " (not currently active)" : ""}</option>)}</select><small>Inactive grades cannot be selected.</small></div></div>
        {grade && junior && <JuniorChoices catalogue={catalogue} gradeId={gradeId} rows={gradeRows} selected={selectedAreas} optional={optionalAreas} religionId={religionId} languageId={languageId} onReligion={setReligionId} onLanguage={setLanguageId} onOptional={(id) => toggle(optionalAreas, setOptionalAreas, id)} />}
        {grade && senior && <><div className="form-grid form-grid--two"><div className="form-field"><label htmlFor="pathway">Senior pathway *</label><select id="pathway" value={pathwayId} required onChange={(e) => { setPathwayId(e.target.value); setTrackId(""); setSelectedAreas([]); }}><option value="">Choose pathway</option>{catalogue.pathways.filter((item) => item.system_id === system?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="form-field"><label htmlFor="track">Pathway track *</label><select id="track" value={trackId} required disabled={!pathwayId} onChange={(e) => { setTrackId(e.target.value); setSelectedAreas([]); }}><option value="">Choose track</option>{tracks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div><p className="auth-card__intro">The four core subjects are included automatically. Choose exactly three permitted electives for your selected track.</p><AreaChoices rows={gradeRows.filter((item) => !item.is_core && !item.is_optional_activity && item.pathway_id === pathwayId && (!item.track_id || item.track_id === trackId))} selected={selectedAreas} onToggle={(id) => toggle(selectedAreas, setSelectedAreas, id)} disabled={!trackId} title="Choose 3 electives" /><ValidationMessage result={validation} />{validation && !validation.valid ? null : null}</>}
        {grade && kcse && <><p className="auth-card__intro">Choose 7–9 subjects. English, Kiswahili and exactly one Mathematics option (121 or 122) are required.</p><AreaChoices rows={gradeRows} selected={selectedAreas} onToggle={(id) => toggle(selectedAreas, setSelectedAreas, id)} title="8-4-4 subjects" /><ValidationMessage result={validation} /></>}
        {grade && junior && <ValidationMessage result={validation} />}
        {(junior || senior || kcse) && validation && !validation.valid ? <p className="form-error" role="status">Selection incomplete: {validation.errors[0]?.message}</p> : null}
        <div className="form-grid form-grid--two"><div className="form-field"><label htmlFor="school">School (optional)</label><input id="school" name="school" maxLength={140}/></div><div className="form-field"><label htmlFor="county">County (optional)</label><input id="county" name="county" maxLength={100}/></div><div className="form-field"><label htmlFor="goals">Learning goals (optional)</label><input id="goals" name="goals" maxLength={500}/></div><div className="form-field"><label htmlFor="hobbies">Hobbies (optional)</label><input id="hobbies" name="hobbies" maxLength={250}/></div></div>
        <fieldset className="form-field" style={{ border: 0, padding: 0 }}><legend>Preferred lesson times (optional)</legend><div className="form-grid form-grid--two">{["Weekday mornings", "Weekday afternoons", "Weekday evenings", "Weekends"].map((time) => <label key={time} className="form-check"><input name={`time-${time}`} type="checkbox"/> {time}</label>)}</div></fieldset>
        <div className="form-grid form-grid--two"><div className="form-field"><label htmlFor="guardianName">Guardian name *</label><input id="guardianName" name="guardianName" required maxLength={120}/></div><div className="form-field"><label htmlFor="guardianPhone">Guardian phone *</label><input id="guardianPhone" name="guardianPhone" type="tel" required placeholder="+254…"/></div><div className="form-field"><label htmlFor="guardianWhatsApp">Guardian WhatsApp (optional)</label><input id="guardianWhatsApp" name="guardianWhatsApp" type="tel" placeholder="+254…"/></div></div>
        <label className="form-check"><input name="guardianConsent" type="checkbox" required/> My parent or guardian has given consent for this student account and the information submitted.</label>
      </>}
      {role === "teacher" && <><div className="form-grid form-grid--two"><div className="form-field"><label htmlFor="experience">Teaching experience in years (self-declared, optional)</label><input id="experience" name="experience" type="number" min="0" max="80"/></div><div className="form-field"><label htmlFor="qualifications">Qualifications (optional)</label><input id="qualifications" name="qualifications" placeholder="Separate items with commas" maxLength={300}/></div></div><p className="auth-card__intro">No ID or TSC number is requested.</p><TeacherChoices catalogue={catalogue} pairs={teacherPairs} setPairs={setTeacherPairs}/></>}
      {role === "parent" && <div className="form-field"><label htmlFor="childProfileId">Learner profile UUID (optional)</label><input id="childProfileId" name="childProfileId" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"/><small>This creates a pending request only. The learner must confirm before any learner data is shared.</small></div>}
      {role === "guest" && <label className="form-check"><input name="adultConsent" type="checkbox" required/> I am 18 or older, or my parent/guardian has given consent.</label>}
      <div className="form-grid"><fieldset style={{ border: 0, padding: 0 }}><legend>How would you like to register?</legend><label className="form-check"><input type="radio" name="authmethod" checked={method === "email"} onChange={() => setMethod("email")}/> Email and password</label><label className="form-check"><input type="radio" name="authmethod" checked={method === "phone"} onChange={() => setMethod("phone")}/> Phone number and SMS code</label></fieldset></div>
      <div className="form-grid form-grid--two"><div className="form-field"><label htmlFor="email">Email address {method === "email" ? "*" : "(optional)"}</label><input id="email" name="email" type="email" autoComplete="email" required={method === "email"} /></div>{method === "email" && <div className="form-field"><label htmlFor="password">Password *</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required/></div>}</div>
      {method === "phone" && <p className="auth-card__intro">SMS signup depends on your Supabase phone provider being enabled. Provider errors will be shown, not hidden.</p>}
      <button type="submit" className="button button--primary" disabled={working || loadingCatalogue || ((role === "student" || role === "teacher") && Boolean(catalogueError)) || (role === "student" && (chooserDisabled || Boolean(validation && !validation.valid) || (junior && (selectedAreas.length !== 9 || !religionId || !languageId)) || (kcse && !valid844Math)))}>{working ? "Please wait…" : method === "phone" ? "Send SMS verification code" : "Create account"}</button>
    </form>}
    <p className="auth-card__intro" style={{ marginTop: 18 }}><Link href="/signup">Change account type</Link> · <Link href="/login">Already have an account?</Link></p>
  </section></div></main>;
}

function JuniorChoices({ catalogue, gradeId, rows, selected, optional, religionId, languageId, onReligion, onLanguage, onOptional }: { catalogue: Catalogue; gradeId: string; rows: Row[]; selected: string[]; optional: string[]; religionId: string; languageId: string; onReligion: (id: string) => void; onLanguage: (id: string) => void; onOptional: (id: string) => void }) {
  const areaById = new Map(catalogue.areas.map((item) => [item.id, item]));
  const required = catalogue.links.filter((item) => item.grade_id === gradeId && item.role === "core" && item.is_required).map((item) => item.learning_area_id);
  const parents = rows.filter((row) => required.includes(row.id) && !row.parent_area_id && !row.is_optional_activity);
  const parentLabel = (row: Row | undefined) => `${row?.code ?? ""} ${row?.title ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const religionParent = (row: Row | undefined) => /religious education|religion/.test(parentLabel(row));
  const languageParent = (row: Row | undefined) => /language|kiswahili/.test(parentLabel(row)) && !religionParent(row);
  const religion = rows.filter((row) => row.parent_area_id && religionParent(areaById.get(row.parent_area_id)) && /\b(CRE|IRE|HRE)\b|religious education/i.test(`${row.code} ${row.title}`));
  const languageChoices = rows.filter((row) => {
    if (!row.parent_area_id || !languageParent(areaById.get(row.parent_area_id))) return false;
    return /kiswahili|sign language|\bksl\b/i.test(`${row.code} ${row.title}`);
  });
  const gradeLinks = new Map(catalogue.links.filter((item) => item.grade_id === gradeId).map((item) => [item.learning_area_id, item]));
  const extras = rows.filter((row) => {
    const link = gradeLinks.get(row.id);
    return row.restriction_code === "TUTORING_ONLY" || row.is_optional_activity || link?.role === "optional" || link?.role === "elective";
  });
  return <section className="form-grid"><h3>Junior School: all nine required learning areas</h3><p className="auth-card__intro">The required parent areas are included from the active grade. Choose one language and one Religious Education sub-area; these explicit choices are checked separately.</p><div className="subject-grid">{parents.map((row) => <SubjectCard key={row.id} title={row.title} iconName={row.icon_name} accentColor={row.accent_color} note="Required learning area" selected={selected.includes(row.id)} disabled disabledReason="Required for this grade" />)}</div>{parents.length !== 9 && <p className="form-error" role="alert">The live catalogue lists {parents.length} required parent areas, not nine. Signup is blocked until the catalogue is corrected.</p>}<strong>Choose exactly one language option *</strong>{languageChoices.length ? <div className="subject-grid">{languageChoices.map((row) => { const ksl = row.restriction_code === "DEAF_LEARNER_ONLY" || /sign language|\bksl\b/i.test(`${row.code} ${row.title}`); return <SubjectCard key={row.id} title={row.title} iconName={row.icon_name} accentColor={row.accent_color} note={ksl ? "Requires administrator authorization" : row.description} selected={languageId === row.id} disabled={ksl} disabledReason={ksl ? "Requires administrator authorization" : undefined} onClick={() => onLanguage(languageId === row.id ? "" : row.id)} />; })}</div> : <p className="form-error" role="alert">The active grade has no Kiswahili learning-area choice in the live catalogue.</p>}<strong>Choose exactly one Religious Education option *</strong>{religion.length ? <div className="subject-grid">{religion.map((row) => <SubjectCard key={row.id} title={row.title} iconName={row.icon_name} accentColor={row.accent_color} note={row.description} selected={religionId === row.id} onClick={() => onReligion(religionId === row.id ? "" : row.id)} />)}</div> : <p className="form-error" role="alert">The live catalogue has no active CRE, IRE, or HRE choice for this grade.</p>}<p className="auth-card__intro">Kenya Sign Language requires administrator authorization. Optional tutoring extras are separate and do not count toward the nine required areas.</p><strong>Optional tutoring extras</strong><div className="subject-grid">{extras.map((row) => <SubjectCard key={row.id} title={row.title} iconName={row.icon_name} accentColor={row.accent_color} selected={optional.includes(row.id)} onClick={() => onOptional(row.id)} note="Optional tutoring only" />)}</div></section>;
}
function AreaChoices({ rows, selected, onToggle, disabled = false, title }: { rows: Row[]; selected: string[]; onToggle: (id: string) => void; disabled?: boolean; title: string }) {
  return <section><h3>{title}</h3>{!rows.length ? <p className="form-error">No eligible learning areas are available for this selection in the live catalogue.</p> : <div className="subject-grid">{rows.map((row) => <SubjectCard key={row.id} title={row.title} iconName={row.icon_name} accentColor={row.accent_color} note={row.description} selected={selected.includes(row.id)} disabled={disabled || row.restriction_code === "DEAF_LEARNER_ONLY"} disabledReason={row.restriction_code === "DEAF_LEARNER_ONLY" ? "Requires administrator authorization" : disabled ? "Choose the pathway track first" : undefined} onClick={() => onToggle(row.id)} />)}</div>}</section>;
}
function ValidationMessage({ result }: { result: ReturnType<typeof validateSeniorSelection> | ReturnType<typeof validateJuniorSelection> | ReturnType<typeof validateEightFourFourSelection> | null }) {
  if (!result) return null;
  if (result.valid) return <p className="form-success" role="status">Curriculum selection is valid.</p>;
  return <div className="form-error" role="status"><strong>Selection needs attention:</strong> {result.errors[0]?.message}</div>;
}
function TeacherChoices({ catalogue, pairs, setPairs }: { catalogue: Catalogue; pairs: { gradeId: string; areaId: string }[]; setPairs: (pairs: { gradeId: string; areaId: string }[]) => void }) {
  const [gradeId, setGradeId] = useState("");
  const [areaId, setAreaId] = useState("");
  const add = () => { if (gradeId && areaId && !pairs.some((pair) => pair.gradeId === gradeId && pair.areaId === areaId)) setPairs([...pairs, { gradeId, areaId }]); };
  const grades = catalogue.grades.filter((item) => item.is_active);
  const rows = gradeId ? subjectsForGrade(catalogue, gradeId) : [];
  const remove = (grade: string, area: string) => setPairs(pairs.filter((pair) => pair.gradeId !== grade || pair.areaId !== area));
  return <section className="form-grid"><h2>What do you teach?</h2><div className="form-grid form-grid--two"><div className="form-field"><label htmlFor="teacherGrade">Active grade/category *</label><select id="teacherGrade" value={gradeId} onChange={(e) => { setGradeId(e.target.value); setAreaId(""); }}><option value="">Choose active grade</option>{grades.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="form-field"><label htmlFor="teacherArea">Subject / learning area *</label><select id="teacherArea" value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={!gradeId}><option value="">Choose subject</option>{rows.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div></div><button type="button" className="button button--outline" onClick={add} disabled={!gradeId || !areaId}>Add teaching subject</button><ul aria-label="Selected teaching subjects">{pairs.map((pair) => { const g = catalogue.grades.find((item) => item.id === pair.gradeId); const a = catalogue.areas.find((item) => item.id === pair.areaId); return <li key={`${pair.gradeId}-${pair.areaId}`}>{g?.name} — {a?.title} <button type="button" onClick={() => remove(pair.gradeId, pair.areaId)} aria-label={`Remove ${a?.title}`}>Remove</button></li>; })}</ul></section>;
}

export function LoginForm() {
  const router = useRouter(); const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    if (!client) { setError("Account services are not configured. Please contact support."); setBusy(false); return; }
    const form = new FormData(event.currentTarget); const email = text(form.get("email")); const password = text(form.get("password"));
    try {
      const { data, error: loginError } = await client.auth.signInWithPassword({ email, password });
      if (loginError || !data.user) throw loginError ?? new Error("We could not sign you in.");
      const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (profileError) throw new Error("We signed you in, but could not load your account role. Please try again shortly.");
      const role = String(profile?.role ?? "guest") as Role | "admin";
      const destinations: Record<Role | "admin", string> = { ...roleDestinations, admin: "/admin" };
      router.replace(destinations[role] ?? "/guest/dashboard");
    } catch (e) { setError(plainError(e, "Email or password was not accepted.")); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><div className="container"><section className="auth-card" style={{ maxWidth: 520, margin: "0 auto" }}><h1>Sign in</h1><p className="auth-card__intro">Welcome back to Lexify School.</p>{error && <div role="alert" className="form-error">{error}</div>}{message && <div role="status" className="form-success">{message}</div>}<form className="form-grid" onSubmit={submit}><div className="form-field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required/></div><div className="form-field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required/></div><button className="button button--primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form><p className="auth-card__intro" style={{ marginTop: 16 }}><Link href="/password/reset">Forgot your password?</Link> · <Link href="/signup">Create account</Link></p></section></div></main>;
}

export function PasswordResetForm() {
  const client = useMemo(() => getSupabaseBrowserClient(), []); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setSuccess(""); setBusy(true); if (!client) { setError("Account services are not configured."); setBusy(false); return; } const email = text(new FormData(event.currentTarget).get("email")); try { const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/password/update` }); if (resetError) throw resetError; setSuccess("If the address belongs to an account, password reset instructions have been sent. Check your inbox."); } catch (e) { setError(plainError(e, "We could not request a password reset.")); } finally { setBusy(false); } }
  return <main className="auth-page"><div className="container"><section className="auth-card" style={{ maxWidth: 520, margin: "0 auto" }}><h1>Reset your password</h1><p className="auth-card__intro">We’ll email a secure reset link if this address has an account.</p>{error && <div className="form-error" role="alert">{error}</div>}{success && <div className="form-success" role="status">{success}</div>}<form className="form-grid" onSubmit={submit}><div className="form-field"><label htmlFor="email">Account email</label><input id="email" type="email" name="email" autoComplete="email" required/></div><button className="button button--primary" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button></form><p><Link href="/login">Back to sign in</Link></p></section></div></main>;
}

export function PasswordUpdateForm() {
  const client = useMemo(() => getSupabaseBrowserClient(), []); const router = useRouter(); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setSuccess(""); const form = new FormData(event.currentTarget); const password = text(form.get("password")); const repeat = text(form.get("repeat")); if (password.length < 8) { setError("Use a password with at least 8 characters."); return; } if (password !== repeat) { setError("The passwords do not match."); return; } if (!client) { setError("Account services are not configured."); return; } setBusy(true); try { const { error: updateError } = await client.auth.updateUser({ password }); if (updateError) throw updateError; setSuccess("Password updated. You can now sign in with your new password."); setTimeout(() => router.replace("/login"), 900); } catch (e) { setError(plainError(e, "We could not update your password. Open a fresh reset link and try again.")); } finally { setBusy(false); } }
  return <main className="auth-page"><div className="container"><section className="auth-card" style={{ maxWidth: 520, margin: "0 auto" }}><h1>Choose a new password</h1><p className="auth-card__intro">Open this page from the secure password reset link sent to your email.</p>{error && <div className="form-error" role="alert">{error}</div>}{success && <div className="form-success" role="status">{success}</div>}<form className="form-grid" onSubmit={submit}><div className="form-field"><label htmlFor="password">New password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required/></div><div className="form-field"><label htmlFor="repeat">Confirm new password</label><input id="repeat" name="repeat" type="password" autoComplete="new-password" minLength={8} required/></div><button className="button button--primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></form></section></div></main>;
}

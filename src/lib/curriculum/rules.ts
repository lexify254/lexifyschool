export type SubjectId = string | number;

export type SeniorPathway = "STEM" | "Social Sciences" | "Arts and Sports Science";
export type KcseGroup = "I" | "II" | "III" | "IV" | "V";

/** Subject data may come from an editable curriculum catalogue or a caller-created record. */
export interface CurriculumSubject {
  id: SubjectId;
  name?: string;
  title?: string;
  label?: string;
  code?: string;
  kcseCode?: string;
  curriculumArea?: string;
  area?: string;
  kind?: string;
  parentAreaId?: SubjectId;
  isAreaContainer?: boolean;
  group?: KcseGroup | string;
  groups?: readonly (KcseGroup | string)[];
  pathway?: SeniorPathway | string;
  pathways?: readonly (SeniorPathway | string)[];
  track?: string;
  tracks?: readonly string[];
  isCore?: boolean;
  isReligiousEducation?: boolean;
  isKenyaSignLanguage?: boolean;
  requiresDeafLearner?: boolean;
  overlapsWith?: readonly SubjectId[];
  [key: string]: unknown;
}

export type SubjectSelection = SubjectId | CurriculumSubject;

/** A matcher can refer to an editable subject by ID, code, display name, or curriculum area. */
export type SubjectMatcher = string | {
  ids?: readonly SubjectId[];
  codes?: readonly string[];
  names?: readonly string[];
  areas?: readonly string[];
};

export interface CurriculumRuleConfig {
  /** Keys/aliases for the nine rationalised Junior School learning-area slots. */
  junior?: {
    coreAreaKeys?: readonly string[];
    tutoringAreaKeys?: readonly string[];
    areaAliases?: Readonly<Record<string, readonly string[]>>;
    religiousEducationAreaKey?: string;
    languageAreaKey?: string;
  };
  senior?: {
    coreAreaKeys?: readonly string[];
    mathAreaKey?: string;
    languageAreaKey?: string;
    religiousEducationMatchers?: readonly SubjectMatcher[];
    signLanguageMatchers?: readonly SubjectMatcher[];
    /** Defaults to zero. When enabled, permits a bounded number of electives from other pathways. */
    maxCrossPathwayElectives?: number;
    overlappingSubjectSets?: readonly (readonly SubjectMatcher[])[];
  };
  eightFourFour?: {
    minSubjects?: number;
    maxSubjects?: number;
    requiredGroupI?: readonly SubjectMatcher[];
    groupIIMinimum?: number;
    groupIIIMinimum?: number;
    groupIVVMinimum?: number;
    religiousEducationMatchers?: readonly SubjectMatcher[];
    signLanguageMatchers?: readonly SubjectMatcher[];
  };
}

export interface CurriculumError {
  code: string;
  message: string;
  subjectIds?: SubjectId[];
  details?: Readonly<Record<string, string | number | boolean>>;
}

export interface ValidationResult {
  valid: boolean;
  errors: CurriculumError[];
  /** Final subjects, including automatically added core subjects where applicable. */
  subjects: CurriculumSubject[];
  subjectIds: SubjectId[];
}

export interface JuniorValidationResult extends ValidationResult {
  coreSubjects: CurriculumSubject[];
  optionalTutoringSubjects: CurriculumSubject[];
}

export interface SeniorValidationResult extends ValidationResult {
  coreSubjects: CurriculumSubject[];
  electives: CurriculumSubject[];
  pathway?: SeniorPathway;
}

export interface EightFourFourValidationResult extends ValidationResult {
  groupCounts: Record<KcseGroup, number>;
}

export interface JuniorValidationInput {
  grade: number;
  catalog: readonly CurriculumSubject[];
  selected: readonly SubjectSelection[];
  isDeafLearner?: boolean;
  config?: CurriculumRuleConfig;
}

export interface SeniorValidationInput {
  grade: number;
  catalog: readonly CurriculumSubject[];
  selected: readonly SubjectSelection[];
  pathway?: SeniorPathway | string;
  track?: string;
  isDeafLearner?: boolean;
  config?: CurriculumRuleConfig;
}

export interface EightFourFourValidationInput {
  form: 3 | 4;
  catalog: readonly CurriculumSubject[];
  selected: readonly SubjectSelection[];
  isDeafLearner?: boolean;
  config?: CurriculumRuleConfig;
}

export const DEFAULT_JUNIOR_CORE_AREA_KEYS = [
  "english",
  "language",
  "mathematics",
  "integrated-science",
  "social-studies",
  "religious-education",
  "agriculture",
  "pre-technical-studies",
  "creative-arts-and-sports",
] as const;

const JUNIOR_TUTORING_KEYS = [
  "french", "german", "mandarin-chinese", "arabic", "indigenous-language",
  "computer-studies", "home-science", "business-studies", "visual-arts", "performing-arts",
];
const DEFAULT_SENIOR_CORE_KEYS = ["english", "language", "community-service-learning", "mathematics"] as const;
const DEFAULT_OVERLAPS: readonly (readonly SubjectMatcher[])[] = [
  ["General Science", "Biology"],
  ["General Science", "Chemistry"],
  ["General Science", "Physics"],
];
const DEFAULT_GROUP_I: readonly SubjectMatcher[] = ["English", "Kiswahili", "Mathematics"];
const GROUPS: readonly KcseGroup[] = ["I", "II", "III", "IV", "V"];
export type CurriculumSystemKind = "junior" | "senior" | "kcse" | "unknown";

/** Identify a curriculum family from live system and grade labels, not exact seed codes. */
export function classifyCurriculumSystem(
  system: { code?: unknown; name?: unknown },
  grade?: { code?: unknown; name?: unknown },
): CurriculumSystemKind {
  const systemLabel = normalize(`${String(system.code ?? "")} ${String(system.name ?? "")}`);
  const gradeLabel = normalize(`${String(grade?.code ?? "")} ${String(grade?.name ?? "")}`);
  const combined = `${systemLabel}-${gradeLabel}`;
  if (systemLabel.includes("senior") || /(?:^|-)grade-?(?:10|11|12)(?:-|$)/.test(gradeLabel)) return "senior";
  if (systemLabel.includes("junior") || /(?:^|-)grade-?(?:7|8|9)(?:-|$)/.test(gradeLabel)) return "junior";
  if (/8-?4-?4|kcse|844/.test(systemLabel) ||
      (systemLabel.includes("secondary") && /form-?[34]|f[34]/.test(gradeLabel)) ||
      (/form-?[34]|f[34]/.test(combined) && /secondary|kcse|844|8-4-4/.test(combined))) return "kcse";
  return "unknown";
}

const normalize = (value: unknown): string => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const idKey = (id: SubjectId): string => String(id);
const subjectName = (subject: CurriculumSubject): string => subject.name ?? subject.title ?? subject.label ?? idKey(subject.id);
const fieldsOf = (subject: CurriculumSubject): string[] => [
  idKey(subject.id), subject.code, subject.kcseCode, subject.name, subject.title, subject.label,
  subject.curriculumArea, subject.area, subject.kind,
].filter((value): value is string => typeof value === "string").map(normalize);

function textMatches(value: string, candidate: string): boolean {
  const normalizedValue = normalize(value);
  const normalizedCandidate = normalize(candidate);
  if (!normalizedValue || !normalizedCandidate) return false;
  return normalizedValue === normalizedCandidate || normalizedValue.includes(`${normalizedCandidate}-`) ||
    normalizedValue.startsWith(`${normalizedCandidate}-`) || normalizedValue.includes(`-${normalizedCandidate}-`) ||
    normalizedValue.endsWith(`-${normalizedCandidate}`);
}

function matches(subject: CurriculumSubject, matcher: SubjectMatcher): boolean {
  if (typeof matcher === "string") return fieldsOf(subject).some((field) => textMatches(field, matcher));
  if (matcher.ids?.some((id) => idKey(id) === idKey(subject.id))) return true;
  if (matcher.codes?.some((code) => subject.code === code || fieldsOf(subject).some((field) => textMatches(field, code)))) return true;
  if (matcher.names?.some((name) => fieldsOf(subject).some((field) => textMatches(field, name)))) return true;
  if (matcher.areas?.some((area) => [subject.curriculumArea, subject.area].some((value) => typeof value === "string" && textMatches(value, area)))) return true;
  return false;
}

const matchesAny = (subject: CurriculumSubject, matchers: readonly SubjectMatcher[]): boolean => matchers.some((matcher) => matches(subject, matcher));

function normalizedArea(subject: CurriculumSubject, config?: CurriculumRuleConfig): string {
  const raw = normalize(subject.curriculumArea ?? subject.area ?? subject.kind ?? "");
  const allAliases: Record<string, readonly string[]> = {
    english: ["english", "advanced-english", "literature-in-english"],
    language: ["language", "kiswahili", "kenya-sign-language", "sign-language", "ksl"],
    mathematics: ["mathematics", "math", "core-mathematics", "essential-mathematics", "advanced-mathematics"],
    "integrated-science": ["integrated-science", "science"],
    "social-studies": ["social-studies"],
    "religious-education": ["religious-education", "cre", "ire", "hre", "christian-religious-education", "islamic-religious-education", "hindu-religious-education"],
    agriculture: ["agriculture"],
    "pre-technical-studies": ["pre-technical-studies", "pre-technical"],
    "creative-arts-and-sports": ["creative-arts-and-sports", "creative-arts", "sports-and-recreation"],
    "community-service-learning": ["community-service-learning", "csl"],
  };
  for (const [key, aliases] of Object.entries({ ...allAliases, ...(config?.junior?.areaAliases ?? {}) })) {
    if (key === raw || aliases.some((alias) => textMatches(raw, alias))) return key;
  }
  const name = normalize(subjectName(subject));
  const source = `${idKey(subject.id)}-${subject.code ?? ""}-${name}`;
  for (const [key, aliases] of Object.entries({ ...allAliases, ...(config?.junior?.areaAliases ?? {}) })) {
    if (aliases.some((alias) => textMatches(source, alias))) return key;
  }
  return "";
}

function isReligiousEducation(subject: CurriculumSubject, custom?: readonly SubjectMatcher[]): boolean {
  return subject.isReligiousEducation === true || matchesAny(subject, custom ?? []) ||
    ["cre", "ire", "hre", "christian-religious-education", "islamic-religious-education", "hindu-religious-education"]
      .some((alias) => fieldsOf(subject).some((field) => textMatches(field, alias)));
}

function isSignLanguage(subject: CurriculumSubject, custom?: readonly SubjectMatcher[]): boolean {
  return subject.isKenyaSignLanguage === true || subject.requiresDeafLearner === true || matchesAny(subject, custom ?? []) ||
    ["kenya-sign-language", "sign-language", "ksl"].some((alias) => fieldsOf(subject).some((field) => textMatches(field, alias)));
}

function isKiswahili(subject: CurriculumSubject): boolean {
  return fieldsOf(subject).some((field) => textMatches(field, "kiswahili"));
}

function isJuniorOptional(subject: CurriculumSubject, config?: CurriculumRuleConfig): boolean {
  if (subject.curriculumArea && config?.junior?.tutoringAreaKeys?.includes(subject.curriculumArea)) return true;
  return JUNIOR_TUTORING_KEYS.some((name) => fieldsOf(subject).some((field) => textMatches(field, name)));
}

function canonicalPathway(value: string | undefined): SeniorPathway | undefined {
  const normalized = normalize(value);
  if (["stem", "science-technology-engineering-mathematics"].includes(normalized)) return "STEM";
  if (["social-sciences", "social-science"].includes(normalized)) return "Social Sciences";
  if (["arts-and-sports-science", "arts-sports-science", "arts-and-sports"].includes(normalized)) return "Arts and Sports Science";
  return undefined;
}

function subjectPathways(subject: CurriculumSubject): SeniorPathway[] {
  const values = [...(subject.pathways ?? []), ...(subject.pathway ? [subject.pathway] : [])];
  const found = values.map((value) => canonicalPathway(String(value))).filter((value): value is SeniorPathway => Boolean(value));
  if (found.length) return [...new Set(found)];
  const text = fieldsOf(subject).join("-");
  if (["advanced-mathematics", "biology", "chemistry", "physics", "general-science", "agriculture", "computer-studies", "home-science", "drawing-and-design", "aviation", "building-construction", "electrical-technology", "metal-technology", "power-mechanics", "wood-technology", "media-technology", "marine-and-fisheries"].some((name) => textMatches(text, name))) return ["STEM"];
  if (["advanced-english", "literature-in-english", "indigenous-language", "kiswahili-kipevu", "fasihi-ya-kiswahili", "sign-language", "arabic", "french", "german", "mandarin-chinese", "history-and-citizenship", "geography", "business-studies", "christian-religious-education", "islamic-religious-education", "hindu-religious-education", "cre", "ire", "hre"].some((name) => textMatches(text, name))) return ["Social Sciences"];
  if (["sports-and-recreation", "physical-education", "music-and-dance", "theatre-and-film", "fine-arts"].some((name) => textMatches(text, name))) return ["Arts and Sports Science"];
  return [];
}

interface PickedSubjects { selected: CurriculumSubject[]; errors: CurriculumError[] }
function resolveSelection(catalog: readonly CurriculumSubject[], selected: readonly SubjectSelection[]): PickedSubjects {
  const byId = new Map(catalog.map((subject) => [idKey(subject.id), subject]));
  const errors: CurriculumError[] = [];
  const result: CurriculumSubject[] = [];
  const seen = new Set<string>();
  for (const item of selected) {
    const record = typeof item === "object" ? item : undefined;
    const id = record?.id ?? item as SubjectId;
    const key = idKey(id);
    if (seen.has(key)) {
      errors.push({ code: "duplicate-subject", message: `Subject ${record ? subjectName(record) : key} was selected more than once.`, subjectIds: [id] });
      continue;
    }
    seen.add(key);
    const found = byId.get(key) ?? record;
    if (!found) {
      errors.push({ code: "unknown-subject", message: `Selected subject ${key} is not in the supplied curriculum catalogue.`, subjectIds: [id] });
      continue;
    }
    result.push(found);
  }
  return { selected: result, errors };
}

function pushError(errors: CurriculumError[], code: string, message: string, subjects: readonly CurriculumSubject[] = [], details?: CurriculumError["details"]): void {
  const subjectIds = subjects.map((subject) => subject.id).sort((a, b) => idKey(a).localeCompare(idKey(b)));
  errors.push({ code, message, ...(subjectIds.length ? { subjectIds } : {}), ...(details ? { details } : {}) });
}

function finish(errors: CurriculumError[], subjects: CurriculumSubject[]): ValidationResult {
  const stableErrors = errors.map((error, index) => ({ error, index }))
    .sort((a, b) => a.index - b.index || a.error.code.localeCompare(b.error.code))
    .map(({ error }) => error);
  return { valid: stableErrors.length === 0, errors: stableErrors, subjects, subjectIds: subjects.map((subject) => subject.id) };
}

function findArea(subjects: readonly CurriculumSubject[], areaKey: string, config?: CurriculumRuleConfig): CurriculumSubject[] {
  return subjects.filter((subject) => normalizedArea(subject, config) === areaKey);
}

function validateKsl(subjects: readonly CurriculumSubject[], isDeafLearner: boolean | undefined, errors: CurriculumError[], custom?: readonly SubjectMatcher[]): void {
  const found = subjects.filter((subject) => isSignLanguage(subject, custom));
  if (found.length && !isDeafLearner) pushError(errors, "ksl-requires-deaf-learner", "Kenya Sign Language is selectable only for a learner marked as deaf.", found);
}

/** Validate Junior School CBE Grades 7–9. Optional tutoring choices never enter the nine-area core. */
export function validateJuniorSelection(input: JuniorValidationInput): JuniorValidationResult {
  const config = input.config;
  const { selected, errors } = resolveSelection(input.catalog, input.selected);
  const keys = config?.junior?.coreAreaKeys ?? DEFAULT_JUNIOR_CORE_AREA_KEYS;
  const religionKey = config?.junior?.religiousEducationAreaKey ?? "religious-education";
  const languageKey = config?.junior?.languageAreaKey ?? "language";
  if (![7, 8, 9].includes(input.grade)) pushError(errors, "invalid-grade", "Junior School grade must be 7, 8, or 9.", [], { grade: input.grade });
  validateKsl(selected, input.isDeafLearner, errors);

  const optionalTutoringSubjects = selected.filter((subject) => isJuniorOptional(subject, config));
  const selectedCore = selected.filter((subject) => !optionalTutoringSubjects.includes(subject));
  // If a selected required parent is only a category container and a specific linked
  // sub-area was selected, validate the sub-area in that slot. Callers may still persist
  // the required parent link alongside it when the database RPC requires that relationship.
  const selectedWithChildren = selectedCore.filter((subject) =>
    !(subject.isAreaContainer && selectedCore.some((candidate) => String(candidate.parentAreaId ?? "") === idKey(subject.id))),
  );
  for (const subject of selectedWithChildren) {
    const area = normalizedArea(subject, config);
    if (!keys.includes(area)) pushError(errors, "subject-not-in-junior-curriculum", `${subjectName(subject)} is not one of the rationalised core areas or configured tutoring extras.`, [subject]);
  }
  const coreSubjects: CurriculumSubject[] = [];
  for (const key of keys) {
    const inArea = selectedWithChildren.filter((subject) => normalizedArea(subject, config) === key);
    if (inArea.length === 0) {
      const special = key === religionKey ? ["religious-education-required", "Choose one Religious Education option (CRE, IRE, or HRE)."]
        : key === languageKey ? ["language-choice-required", "Choose Kiswahili or Kenya Sign Language for the language learning area."]
          : ["core-area-required", `Choose a subject for the ${key.replace(/-/g, " ")} learning area.`];
      pushError(errors, special[0] as string, special[1] as string, [], { area: key });
    } else if (inArea.length > 1) {
      pushError(errors, "multiple-subjects-in-core-area", `Choose exactly one subject for the ${key.replace(/-/g, " ")} learning area.`, inArea, { area: key, count: inArea.length });
    }
    coreSubjects.push(...inArea.slice(0, 1));
  }
  // The selectors must represent precisely one option in each of these slots, even with custom area keys.
  const reChoices = selectedWithChildren.filter((subject) => isReligiousEducation(subject));
  if (reChoices.length > 1 && !errors.some((error) => error.code === "multiple-subjects-in-core-area" && error.details?.area === religionKey)) {
    pushError(errors, "religious-education-count", "Choose exactly one Religious Education subject.", reChoices, { count: reChoices.length });
  }
  const languageChoices = selectedWithChildren.filter((subject) => isKiswahili(subject) || isSignLanguage(subject));
  if (languageChoices.length > 1 && !errors.some((error) => error.code === "multiple-subjects-in-core-area" && error.details?.area === languageKey)) {
    pushError(errors, "language-choice-count", "Choose exactly one language option: Kiswahili or Kenya Sign Language.", languageChoices, { count: languageChoices.length });
  }
  const subjects = [...coreSubjects, ...optionalTutoringSubjects];
  const base = finish(errors, subjects);
  return { ...base, coreSubjects, optionalTutoringSubjects };
}

function seniorCoreFor(input: SeniorValidationInput, selected: readonly CurriculumSubject[], errors: CurriculumError[]): CurriculumSubject[] {
  const keys = input.config?.senior?.coreAreaKeys ?? DEFAULT_SENIOR_CORE_KEYS;
  const mathKey = input.config?.senior?.mathAreaKey ?? "mathematics";
  const languageKey = input.config?.senior?.languageAreaKey ?? "language";
  const pathway = canonicalPathway(input.pathway);
  const result: CurriculumSubject[] = [];
  for (const key of keys) {
    const all = findArea(input.catalog, key, input.config);
    const selectedInArea = selected.filter((subject) => normalizedArea(subject, input.config) === key);
    let chosen: CurriculumSubject | undefined;
    if (key === languageKey) {
      chosen = selectedInArea.find((subject) => isKiswahili(subject) || isSignLanguage(subject)) ??
        all.find((subject) => isSignLanguage(subject) === Boolean(input.isDeafLearner)) ?? all[0];
    } else if (key === mathKey) {
      const wanted = pathway === "STEM" ? "core-mathematics" : "essential-mathematics";
      chosen = all.find((subject) => fieldsOf(subject).some((field) => textMatches(field, wanted))) ??
        selectedInArea.find((subject) => fieldsOf(subject).some((field) => textMatches(field, wanted))) ??
        all.find((subject) => fieldsOf(subject).some((field) => textMatches(field, pathway === "STEM" ? "mathematics" : "essential-mathematics")));
      const wrong = selectedInArea.filter((subject) => subject !== chosen);
      if (wrong.length) pushError(errors, "math-pathway-mismatch", `${pathway === "STEM" ? "Core" : "Essential"} Mathematics is required for the selected pathway.`, wrong, { expected: wanted });
    } else {
      chosen = selectedInArea[0] ?? all[0];
    }
    if (!chosen) pushError(errors, "core-subject-unavailable", `The catalogue does not provide a subject for the required senior core area: ${key}.`, [], { area: key });
    else result.push(chosen);
  }
  return result;
}

function isSelectedCoreVariant(subject: CurriculumSubject, coreSubjects: readonly CurriculumSubject[], config?: CurriculumRuleConfig): boolean {
  if (coreSubjects.some((core) => idKey(core.id) === idKey(subject.id))) return true;
  if (subject.isCore === true) return true;
  const area = normalizedArea(subject, config);
  const name = normalize(subjectName(subject));
  if (area === "language") return isKiswahili(subject) || isSignLanguage(subject);
  if (area === "community-service-learning") return true;
  if (area === "mathematics") return ["core-mathematics", "essential-mathematics", "mathematics"].includes(name);
  return area === "english" && name === "english";
}

/** Validate Senior School CBE Grades 10–12 and return four auto-included core areas plus electives. */
export function validateSeniorSelection(input: SeniorValidationInput): SeniorValidationResult {
  const { selected, errors } = resolveSelection(input.catalog, input.selected);
  const pathway = canonicalPathway(input.pathway);
  if (![10, 11, 12].includes(input.grade)) pushError(errors, "invalid-grade", "Senior School grade must be 10, 11, or 12.", [], { grade: input.grade });
  if (!pathway) pushError(errors, "pathway-required", "Choose STEM, Social Sciences, or Arts and Sports Science.");
  validateKsl(selected, input.isDeafLearner, errors, input.config?.senior?.signLanguageMatchers);
  const coreSubjects = seniorCoreFor(input, selected, errors);
  const coreIds = new Set(coreSubjects.map((subject) => idKey(subject.id)));
  const electives = selected.filter((subject) => !coreIds.has(idKey(subject.id)) && !isSelectedCoreVariant(subject, coreSubjects, input.config));
  if (electives.length !== 3) pushError(errors, "elective-count", `Select exactly 3 electives; ${electives.length} selected.`, electives, { expected: 3, actual: electives.length });

  const maxCross = Math.max(0, input.config?.senior?.maxCrossPathwayElectives ?? 0);
  let crossPathway = 0;
  if (pathway) {
    for (const subject of electives) {
      const paths = subjectPathways(subject);
      if (paths.length && !paths.includes(pathway)) {
        crossPathway += 1;
        const businessStudiesInStem = pathway === "STEM" && fieldsOf(subject).some((field) => textMatches(field, "business-studies"));
        if (businessStudiesInStem) pushError(errors, "stem-business-studies", "Business Studies is not a STEM elective; choose an elective from the selected STEM pathway.", [subject], { pathway });
        else if (crossPathway > maxCross) pushError(errors, "elective-outside-pathway", `${subjectName(subject)} is not in the selected ${pathway} pathway.`, [subject], { pathway, subjectPathways: paths.join(", ") });
      }
      const subjectTracks = [...(subject.tracks ?? []), ...(subject.track ? [subject.track] : [])];
      if (input.track && subjectTracks.length && !subjectTracks.some((value) => normalize(value) === normalize(input.track))) {
        pushError(errors, "elective-outside-track", `${subjectName(subject)} is not available in the selected ${input.track} track.`, [subject], { track: input.track });
      }
    }
    if (crossPathway > maxCross && maxCross > 0) pushError(errors, "cross-pathway-elective-limit", `At most ${maxCross} elective(s) may come from another pathway.`, electives, { maximum: maxCross, actual: crossPathway });
  }

  const overlaps = input.config?.senior?.overlappingSubjectSets ?? DEFAULT_OVERLAPS;
  for (const overlapSet of overlaps) {
    const matched = electives.filter((subject) => matches(subject, overlapSet[0]!) || overlapSet.slice(1).some((matcher) => matches(subject, matcher)));
    // Each configured set is a conflicting group: two or more members cannot coexist.
    if (matched.length > 1) pushError(errors, "overlapping-electives", `${matched.map(subjectName).join(" and ")} cannot be selected together.`, matched);
  }
  for (const subject of electives) {
    const linked = (subject.overlapsWith ?? []).map(idKey);
    const other = electives.filter((candidate) => candidate.id !== subject.id && (linked.includes(idKey(candidate.id)) || (candidate.overlapsWith ?? []).map(idKey).includes(idKey(subject.id))));
    if (other.length) pushError(errors, "overlapping-electives", `${subjectName(subject)} overlaps with ${other.map(subjectName).join(", ")}.`, [subject, ...other]);
  }
  const reChoices = [...selected, ...electives.filter((subject) => !selected.includes(subject))]
    .filter((subject) => isReligiousEducation(subject, input.config?.senior?.religiousEducationMatchers));
  if (reChoices.length > 1) pushError(errors, "multiple-religious-education", "At most one Religious Education subject may be selected.", reChoices, { count: reChoices.length });
  const subjects = [...coreSubjects, ...electives];
  const base = finish(errors, subjects);
  return { ...base, coreSubjects, electives, ...(pathway ? { pathway } : {}) };
}

function kcseGroups(subject: CurriculumSubject): KcseGroup[] {
  const raw = [...(subject.groups ?? []), ...(subject.group ? [subject.group] : [])].map((value) => normalize(value));
  const groupAliases: Record<KcseGroup, readonly string[]> = {
    I: ["i", "1", "group-i", "group-1", "groupi", "group1"],
    II: ["ii", "2", "group-ii", "group-2", "groupii", "group2"],
    III: ["iii", "3", "group-iii", "group-3", "groupiii", "group3"],
    IV: ["iv", "4", "group-iv", "group-4", "groupiv", "group4"],
    V: ["v", "5", "group-v", "group-5", "groupv", "group5"],
  };
  const groups = GROUPS.filter((group) => raw.some((value) => groupAliases[group].includes(value)));
  if (groups.length) return [...new Set(groups)];
  const text = fieldsOf(subject).join("-");
  const aliases: Record<KcseGroup, readonly string[]> = {
    I: ["english", "kiswahili", "mathematics"],
    II: ["biology", "physics", "chemistry"],
    III: ["history-and-government", "history-and-citizenship", "geography", "christian-religious-education", "islamic-religious-education", "hindu-religious-education", "cre", "ire", "hre"],
    IV: ["home-science", "art-and-design", "agriculture", "computer-studies", "aviation", "woodwork", "metalwork", "building-construction", "power-mechanics", "electricity", "drawing-and-design"],
    V: ["french", "german", "arabic", "kenya-sign-language", "sign-language", "ksl", "music", "business-studies"],
  };
  return GROUPS.filter((group) => aliases[group].some((alias) => textMatches(text, alias)));
}

/** Validate Form 3/4 KCSE subject selection against the editable group rules. */
export function validateEightFourFourSelection(input: EightFourFourValidationInput): EightFourFourValidationResult {
  const { selected, errors } = resolveSelection(input.catalog, input.selected);
  const config = input.config?.eightFourFour;
  const min = config?.minSubjects ?? 7;
  const max = config?.maxSubjects ?? 9;
  if (selected.length < min) pushError(errors, "minimum-subject-count", `Select at least ${min} subjects; ${selected.length} selected.`, selected, { minimum: min, actual: selected.length });
  if (selected.length > max) pushError(errors, "maximum-subject-count", `Select no more than ${max} subjects; ${selected.length} selected.`, selected, { maximum: max, actual: selected.length });
  validateKsl(selected, input.isDeafLearner, errors, config?.signLanguageMatchers);

  const requiredGroupI = config?.requiredGroupI ?? DEFAULT_GROUP_I;
  for (const matcher of requiredGroupI) {
    if (!selected.some((subject) => matches(subject, matcher))) {
      const label = typeof matcher === "string" ? matcher : matcher.names?.[0] ?? matcher.codes?.[0] ?? matcher.areas?.[0] ?? String(matcher.ids?.[0] ?? "required subject");
      pushError(errors, "required-group-i-subject", `Group I subject ${label} is compulsory and must be selected.`, [], { subject: label });
    }
  }
  const counts: Record<KcseGroup, number> = { I: 0, II: 0, III: 0, IV: 0, V: 0 };
  for (const subject of selected) for (const group of kcseGroups(subject)) counts[group] += 1;
  const thresholds: [KcseGroup, number, string][] = [
    ["II", config?.groupIIMinimum ?? 2, "Group II sciences"],
    ["III", config?.groupIIIMinimum ?? 1, "Group III humanities"],
  ];
  for (const [group, minimum, label] of thresholds) {
    if (counts[group] < minimum) pushError(errors, "kcse-group-minimum", `Select at least ${minimum} subject(s) from ${label}; ${counts[group]} selected.`, selected.filter((subject) => kcseGroups(subject).includes(group)), { group, minimum, actual: counts[group] });
  }
  const groupIVV = counts.IV + counts.V;
  const minIVV = config?.groupIVVMinimum ?? 1;
  if (groupIVV < minIVV) pushError(errors, "kcse-group-minimum", `Select at least ${minIVV} subject(s) from Group IV or V; ${groupIVV} selected.`, selected.filter((subject) => kcseGroups(subject).some((group) => group === "IV" || group === "V")), { groups: "IV/V", minimum: minIVV, actual: groupIVV });
  const reChoices = selected.filter((subject) => isReligiousEducation(subject, config?.religiousEducationMatchers));
  if (reChoices.length > 1) pushError(errors, "multiple-religious-education", "At most one Religious Education subject may be selected.", reChoices, { count: reChoices.length });
  const groupCounts = counts;
  const base = finish(errors, selected);
  return { ...base, groupCounts };
}

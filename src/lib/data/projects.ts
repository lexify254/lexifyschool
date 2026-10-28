export type ProjectRow = Record<string, unknown>;

export type ProjectSort = "featured" | "price-asc" | "price-desc" | "title";

export type ProjectFilters = {
  q: string;
  software: string;
  difficulty: string;
  maxPrice?: number;
  freeOnly: boolean;
  sort: ProjectSort;
};

export type ProjectSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function cleanText(value: string | undefined, maxLength: number): string {
  return (value ?? "").trim().slice(0, maxLength);
}

export function normalizeProjectFilters(
  params: ProjectSearchParams
): ProjectFilters {
  const rawMaxPrice = cleanText(first(params.maxPrice), 16);
  const parsedMaxPrice = rawMaxPrice ? Number(rawMaxPrice) : Number.NaN;
  const maxPrice =
    Number.isFinite(parsedMaxPrice) &&
    parsedMaxPrice >= 0 &&
    parsedMaxPrice <= 10_000_000
      ? parsedMaxPrice
      : undefined;
  const requestedSort = first(params.sort);
  const sort: ProjectSort =
    requestedSort === "price-asc" ||
    requestedSort === "price-desc" ||
    requestedSort === "title"
      ? requestedSort
      : "featured";

  return {
    q: cleanText(first(params.q), 80),
    software: cleanText(first(params.software), 60),
    difficulty: cleanText(first(params.difficulty), 30),
    maxPrice,
    freeOnly: ["on", "true", "1"].includes(first(params.free) ?? ""),
    sort,
  };
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(text).join(" ");
  return "";
}

export function getProjectPriceKes(
  project: ProjectRow,
  now: Date = new Date()
): number {
  if (project.is_free === true) return 0;

  const basePrice = Number(project.price_kes);
  const safeBasePrice =
    Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : 0;
  const hasSalePrice =
    project.sale_price_kes !== null &&
    project.sale_price_kes !== undefined &&
    project.sale_price_kes !== "";
  if (!hasSalePrice) return safeBasePrice;
  // The shared catalogue read omits sale window columns. Do not guess that a
  // sale is active when its dates are unavailable; detail reads include them.
  if (
    project.sale_starts_at === undefined ||
    project.sale_ends_at === undefined
  ) {
    return safeBasePrice;
  }

  const salePrice = Number(project.sale_price_kes);
  if (
    !Number.isFinite(salePrice) ||
    salePrice < 0 ||
    salePrice >= safeBasePrice
  ) {
    return safeBasePrice;
  }

  const startsAt = project.sale_starts_at
    ? new Date(String(project.sale_starts_at)).getTime()
    : Number.NEGATIVE_INFINITY;
  const endsAt = project.sale_ends_at
    ? new Date(String(project.sale_ends_at)).getTime()
    : Number.POSITIVE_INFINITY;
  const nowTime = now.getTime();
  if (
    (Number.isFinite(startsAt) || startsAt === Number.NEGATIVE_INFINITY) &&
    (Number.isFinite(endsAt) || endsAt === Number.POSITIVE_INFINITY) &&
    startsAt <= nowTime &&
    endsAt >= nowTime
  ) {
    return salePrice;
  }
  return safeBasePrice;
}

export function formatProjectPrice(
  project: ProjectRow,
  now: Date = new Date()
): string {
  if (project.is_free === true) return "Free";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2,
  }).format(getProjectPriceKes(project, now));
}

function projectSearchText(project: ProjectRow): string {
  return [
    project.code,
    project.title,
    project.short_description,
    project.description,
    project.software_name,
    project.software_version,
    project.file_types,
    project.difficulty,
    project.licence_type,
  ]
    .map(text)
    .join(" ")
    .toLocaleLowerCase();
}

export function filterAndSortProjects<T extends ProjectRow>(
  projects: T[],
  filters: ProjectFilters,
  now: Date = new Date()
): T[] {
  const query = filters.q.toLocaleLowerCase();
  const software = filters.software.toLocaleLowerCase();
  const difficulty = filters.difficulty.toLocaleLowerCase();

  const matches = projects.filter(project => {
    if (query && !projectSearchText(project).includes(query)) return false;
    if (
      software &&
      !text(project.software_name).toLocaleLowerCase().includes(software)
    ) {
      return false;
    }
    if (
      difficulty &&
      text(project.difficulty).toLocaleLowerCase() !== difficulty
    ) {
      return false;
    }
    if (filters.freeOnly && project.is_free !== true) return false;
    if (
      filters.maxPrice !== undefined &&
      getProjectPriceKes(project, now) > filters.maxPrice
    ) {
      return false;
    }
    return true;
  });

  if (filters.sort === "title") {
    return matches.sort((left, right) =>
      text(left.title).localeCompare(text(right.title), "en", {
        sensitivity: "base",
      })
    );
  }
  if (filters.sort === "price-asc") {
    return matches.sort(
      (left, right) =>
        getProjectPriceKes(left, now) - getProjectPriceKes(right, now)
    );
  }
  if (filters.sort === "price-desc") {
    return matches.sort(
      (left, right) =>
        getProjectPriceKes(right, now) - getProjectPriceKes(left, now)
    );
  }
  return matches;
}

function safeMessagePart(value: string, maxLength: number): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function buildProjectInquiryMessage(input: {
  code: string;
  title: string;
  listedPrice: string;
}): string {
  const title = safeMessagePart(input.title, 120) || "this project";
  const code = safeMessagePart(input.code, 48) || "not listed";
  const listedPrice = safeMessagePart(input.listedPrice, 48) || "not listed";
  return `Hello Lexify School, I would like to ask about “${title}” (project code: ${code}), listed at ${listedPrice}. Is it available? Please confirm the current price, licence terms, and any delivery arrangements. I understand that this chat does not confirm a sale or grant download access.`;
}

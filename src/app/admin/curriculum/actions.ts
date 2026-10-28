"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type SaveState = { ok: boolean; message: string };
const failed = (message: string): SaveState => ({ ok: false, message });
const succeeded = (label: string): SaveState => ({ ok: true, message: `${label} saved.` });

function value(formData: FormData, name: string, maxLength: number): string | null {
  const item = formData.get(name);
  if (typeof item !== "string") return null;
  const trimmed = item.trim();
  return trimmed.length <= maxLength ? trimmed : null;
}

function isUuid(input: string | null): input is string {
  return !!input && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

function isDate(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const date = new Date(`${input}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === input;
}

function dates(formData: FormData): { starts_on: string | null; ends_on: string | null } | null {
  const rawStart = formData.get("starts_on");
  const rawEnd = formData.get("ends_on");
  if ((rawStart !== null && typeof rawStart !== "string") || (rawEnd !== null && typeof rawEnd !== "string")) return null;
  const start = (rawStart ?? "").trim();
  const end = (rawEnd ?? "").trim();
  if (start.length > 10 || end.length > 10) return null;
  if ((start && !isDate(start)) || (end && !isDate(end))) return null;
  if (start && end && end < start) return null;
  return { starts_on: start || null, ends_on: end || null };
}

function active(formData: FormData): boolean | null {
  const state = formData.get("is_active");
  if (state === null) return false;
  return state === "on" ? true : null;
}

async function saveDatesAndStatus(
  table: "education_systems" | "grades",
  id: string | null,
  formData: FormData,
  label: string,
): Promise<SaveState> {
  await requireAdmin();
  if (!isUuid(id)) return failed("This curriculum record could not be identified. Reload and try again.");
  const parsedDates = dates(formData);
  if (!parsedDates) return failed("Enter valid dates. The end date must be the same as or later than the start date.");
  const isActive = active(formData);
  if (isActive === null) return failed("The active-status value is invalid. Reload and try again.");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return failed("Saving is unavailable because the database connection is not configured.");
  const { data, error } = await supabase
    .from(table)
    .update({ ...parsedDates, is_active: isActive })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return failed(`Could not save ${label}: ${error.message}`);
  if (!data) return failed(`${label} was not found or could not be updated.`);
  revalidatePath("/admin/curriculum");
  revalidatePath("/curriculum");
  return succeeded(label);
}

export async function saveEducationSystem(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveDatesAndStatus("education_systems", value(formData, "id", 36), formData, "Education system");
}

export async function saveGrade(_previous: SaveState, formData: FormData): Promise<SaveState> {
  return saveDatesAndStatus("grades", value(formData, "id", 36), formData, "Grade");
}

export async function saveLearningArea(_previous: SaveState, formData: FormData): Promise<SaveState> {
  await requireAdmin();
  const id = value(formData, "id", 36);
  const title = value(formData, "title", 100);
  const iconName = value(formData, "icon_name", 40);
  const accentColor = value(formData, "accent_color", 7);
  const description = value(formData, "description", 500);
  const isActive = active(formData);
  if (!isUuid(id)) return failed("This learning area could not be identified. Reload and try again.");
  if (!title || title.length < 1) return failed("Enter a learning-area title (up to 100 characters).");
  if (!iconName || !/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(iconName)) {
    return failed("Enter an icon name using letters and numbers, starting with a letter (up to 40 characters).");
  }
  if (!accentColor || !/^#[0-9a-fA-F]{6}$/.test(accentColor)) return failed("Enter a six-digit hex accent color, such as #2563EB.");
  if (description === null) return failed("Illustration description must be 500 characters or fewer.");
  if (isActive === null) return failed("The active-status value is invalid. Reload and try again.");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return failed("Saving is unavailable because the database connection is not configured.");
  const { data, error } = await supabase
    .from("learning_areas")
    .update({ title, icon_name: iconName, accent_color: accentColor, description: description || null, is_active: isActive })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return failed(`Could not save learning area: ${error.message}`);
  if (!data) return failed("Learning area was not found or could not be updated.");
  revalidatePath("/admin/curriculum");
  revalidatePath("/curriculum");
  return succeeded("Learning area");
}

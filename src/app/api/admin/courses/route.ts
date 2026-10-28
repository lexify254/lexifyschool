import { adminApi, jsonBody } from "@/lib/admin/http";
import { createAdminCourse, listAdminCourses } from "@/lib/admin/operations";
export const dynamic = "force-dynamic";
export async function GET() {
  return adminApi(() => listAdminCourses());
}
export async function POST(request: Request) {
  return adminApi(async () => createAdminCourse(await jsonBody(request)), 201);
}

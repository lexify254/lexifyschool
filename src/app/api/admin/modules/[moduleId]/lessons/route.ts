import { adminApi, jsonBody } from "@/lib/admin/http";
import { createAdminLesson } from "@/lib/admin/operations";
type Context = { params: Promise<{ moduleId: string }> };
export async function POST(request: Request, { params }: Context) {
  return adminApi(async () => createAdminLesson((await params).moduleId, await jsonBody(request)), 201);
}

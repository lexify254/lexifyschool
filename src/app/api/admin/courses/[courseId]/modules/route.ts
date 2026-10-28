import { adminApi, jsonBody } from "@/lib/admin/http";
import { createAdminModule } from "@/lib/admin/operations";
type Context = { params: Promise<{ courseId: string }> };
export async function POST(request: Request, { params }: Context) {
  return adminApi(async () => createAdminModule((await params).courseId, await jsonBody(request)), 201);
}

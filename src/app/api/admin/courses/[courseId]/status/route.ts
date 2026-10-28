import { adminApi, jsonBody } from "@/lib/admin/http";
import { AdminOperationError, setAdminCourseStatus } from "@/lib/admin/operations";
type Context = { params: Promise<{ courseId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return adminApi(async () => {
    const body = await jsonBody(request);
    if (!body || typeof body !== "object" || !("status" in body)) throw new AdminOperationError("Provide a course status.");
    return setAdminCourseStatus((await params).courseId, (body as { status: unknown }).status);
  });
}

import { adminApi, jsonBody } from "@/lib/admin/http";
import { deleteEmptyDraftCourse, updateAdminCourse } from "@/lib/admin/operations";
type Context = { params: Promise<{ courseId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return adminApi(async () => {
    const { courseId } = await params;
    return updateAdminCourse(courseId, await jsonBody(request));
  });
}
export async function DELETE(_request: Request, { params }: Context) {
  return adminApi(async () => deleteEmptyDraftCourse((await params).courseId));
}

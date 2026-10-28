import { adminApi, jsonBody } from "@/lib/admin/http";
import { deleteUnpublishedAdminLesson, getAdminLesson, updateAdminLesson } from "@/lib/admin/operations";
type Context = { params: Promise<{ lessonId: string }> };
export async function GET(_request: Request, { params }: Context) {
  return adminApi(async () => getAdminLesson((await params).lessonId));
}
export async function PATCH(request: Request, { params }: Context) {
  return adminApi(async () => updateAdminLesson((await params).lessonId, await jsonBody(request)));
}
export async function DELETE(_request: Request, { params }: Context) {
  return adminApi(async () => deleteUnpublishedAdminLesson((await params).lessonId));
}

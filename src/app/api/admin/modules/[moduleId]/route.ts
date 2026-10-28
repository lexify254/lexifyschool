import { adminApi, jsonBody } from "@/lib/admin/http";
import { deleteEmptyAdminModule, updateAdminModule } from "@/lib/admin/operations";
type Context = { params: Promise<{ moduleId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return adminApi(async () => updateAdminModule((await params).moduleId, await jsonBody(request)));
}
export async function DELETE(_request: Request, { params }: Context) {
  return adminApi(async () => deleteEmptyAdminModule((await params).moduleId));
}

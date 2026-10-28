import { adminApi, jsonBody } from "@/lib/admin/http";
import { AdminOperationError, setUserSuspension } from "@/lib/admin/operations";
type Context = { params: Promise<{ userId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return adminApi(async () => {
    const { userId } = await params;
    const body = await jsonBody(request);
    if (!body || typeof body !== "object" || !("is_suspended" in body)) throw new AdminOperationError("Provide an is_suspended boolean.");
    return setUserSuspension(userId, (body as { is_suspended: boolean }).is_suspended);
  });
}

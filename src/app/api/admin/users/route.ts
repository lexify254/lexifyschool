import { adminApi } from "@/lib/admin/http";
import { listAdminUsers } from "@/lib/admin/operations";
export const dynamic = "force-dynamic";
export async function GET() {
  return adminApi(() => listAdminUsers());
}

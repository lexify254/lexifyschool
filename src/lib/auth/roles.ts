export const APP_ROLES = ["student", "parent", "teacher", "guest", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const roleHome: Record<AppRole, string> = {
  student: "/student/dashboard",
  parent: "/parent/dashboard",
  teacher: "/teacher/dashboard",
  guest: "/guest/dashboard",
  admin: "/admin",
};

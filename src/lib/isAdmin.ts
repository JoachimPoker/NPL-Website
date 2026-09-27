// Safe to import from both server and client code.
// Only trust app_metadata: it can only be set server-side. user_metadata is
// editable by the user themselves, so it must never grant admin access.
export function isAdminUser(
  user: { app_metadata?: Record<string, any> } | null | undefined
): boolean {
  const meta = user?.app_metadata
  const roles = Array.isArray(meta?.roles) ? (meta!.roles as string[]) : []
  return roles.includes("admin") || meta?.role === "admin"
}

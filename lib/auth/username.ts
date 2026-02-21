export function staffEmailFromUsername(username: string) {
  const u = username.trim().toLowerCase().replace(/\s+/g, "");
  return `${u}@staff.local`;
}

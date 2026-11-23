export type MobileTab = "home" | "search" | "saved" | "profile";

export function getActiveMobileTab(pathname: string): MobileTab | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path === "/search" || path === "/listings" || path.startsWith("/listings/")) return "search";
  if (path === "/saved" || path.startsWith("/saved/")) return "saved";
  if (path === "/profile") return "profile";
  return null;
}

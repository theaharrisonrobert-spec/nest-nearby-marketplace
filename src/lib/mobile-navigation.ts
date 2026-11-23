export type MobileTab = "home" | "search" | "messages" | "profile" | "settings";

export function getActiveMobileTab(pathname: string): MobileTab | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path === "/search" || path === "/listings" || path.startsWith("/listings/")) return "search";
  if (path === "/messages" || path.startsWith("/messages/")) return "messages";
  if (path === "/profile") return "profile";
  if (path === "/settings") return "settings";
  return null;
}

export { middleware as proxy } from "@/lib/admin/middleware";

export const config = {
  matcher: ["/admin/:path*"],
};

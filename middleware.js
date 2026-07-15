export { default } from "next-auth/middleware";

// Everything requires login except the login page, auth endpoints and static files.
export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};

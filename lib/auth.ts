import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
export type AdminSession = {
  user?: {
    email: string;
    role: "Administrator" | "Redakteur";
    mustChangePassword: boolean;
  };
};
export const sessionOptions = {
  password:
    process.env.SESSION_SECRET || "dev-secret-change-me-dev-secret-change-me",
  cookieName: "drohne_admin",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};
export async function getSession() {
  return getIronSession<AdminSession>(await cookies(), sessionOptions);
}
export async function verifyLogin(email: string, password: string) {
  const adminEmail =
    process.env.ADMIN_EMAIL || "admin@feuerwehr-biebertal.local";
  const defaultHash =
    "$2a$10$97urkHjthw9JLiyd1Ok8peqCEB/ICMREr0wQpeL8yQES1971ieb1K"; // Drohne112!
  if (email.toLowerCase() !== adminEmail.toLowerCase()) return null;
  const ok = await bcrypt.compare(
    password,
    process.env.ADMIN_PASSWORD_HASH || defaultHash,
  );
  return ok
    ? {
        email: adminEmail,
        role: "Administrator" as const,
        mustChangePassword: !process.env.ADMIN_PASSWORD_HASH,
      }
    : null;
}

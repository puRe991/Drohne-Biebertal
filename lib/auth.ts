import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import bcrypt from "bcryptjs";

export type AdminSession = {
  user?: {
    email: string;
    role: "Administrator" | "Redakteur";
    mustChangePassword: boolean;
  };
};

const DEV_SESSION_SECRET = "dev-secret-change-me-dev-secret-change-me";
const DEFAULT_ADMIN_HASH =
  "$2a$10$H2fid/BSH2/1URkVaThQqe.Kge1Hh5M5ASw7ZriaWsbQ.us3nuFCS"; // Drohne112!

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET muss in Produktion gesetzt werden.");
  }
  return DEV_SESSION_SECRET;
}

export function getSessionOptions(): SessionOptions {
  return {
    password: getSessionSecret(),
    cookieName: "drohne_admin",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax" as const,
    },
  };
}

export async function getSession() {
  return getIronSession<AdminSession>(await cookies(), getSessionOptions());
}

export async function verifyLogin(email: string, password: string) {
  const adminEmail =
    process.env.ADMIN_EMAIL || "admin@feuerwehr-biebertal.local";
  if (email.toLowerCase() !== adminEmail.toLowerCase()) return null;

  const ok = await bcrypt.compare(
    password,
    process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_HASH,
  );

  return ok
    ? {
        email: adminEmail,
        role: "Administrator" as const,
        mustChangePassword: !process.env.ADMIN_PASSWORD_HASH,
      }
    : null;
}

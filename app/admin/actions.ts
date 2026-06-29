"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession, verifyLogin } from "@/lib/auth";
import { createSlug, getContent, saveContent } from "@/lib/content";
import { IncidentSchema, SiteContentSchema } from "@/lib/content-schema";

const DEFAULT_INCIDENT_IMAGE =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80";

function adminRedirect(message: string) {
  redirect(`/admin?error=${encodeURIComponent(message)}`);
}

async function requireAdmin() {
  const session = await getSession();
  if (!session.user) redirect("/admin?error=auth");
  return session.user;
}

function getValidationMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join("; ");
  }
  if (error instanceof SyntaxError) return "JSON ist syntaktisch ungültig.";
  return "Inhalte konnten nicht gespeichert werden.";
}

export async function loginAction(form: FormData) {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const user = await verifyLogin(email, password);

  if (!user) redirect("/admin?error=login");

  const session = await getSession();
  session.user = user;
  await session.save();
  redirect("/admin");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/admin");
}

export async function saveJsonAction(form: FormData) {
  await requireAdmin();
  const raw = String(form.get("json") || "");

  try {
    const parsed = SiteContentSchema.parse(JSON.parse(raw));
    saveContent(parsed);
  } catch (error) {
    adminRedirect(getValidationMessage(error));
  }

  redirect("/admin?saved=1");
}

export async function addIncidentAction(form: FormData) {
  await requireAdmin();
  const content = getContent();
  const title = String(form.get("title") || "").trim();

  if (!title) adminRedirect("Titel ist erforderlich.");

  try {
    const incident = IncidentSchema.parse({
      id: createSlug(
        title,
        content.incidents.map((item) => item.id),
      ),
      title,
      date: String(form.get("date") || new Date().toISOString().slice(0, 10)),
      place: String(form.get("place") || "").trim(),
      category: String(form.get("category") || "Lageerkundung").trim(),
      status: "abgeschlossen",
      duration: String(form.get("duration") || "").trim(),
      image: String(form.get("image") || DEFAULT_INCIDENT_IMAGE).trim(),
      description: String(form.get("description") || "").trim(),
    });

    content.incidents.unshift(incident);
    saveContent(content);
  } catch (error) {
    adminRedirect(getValidationMessage(error));
  }

  redirect("/admin?saved=1");
}

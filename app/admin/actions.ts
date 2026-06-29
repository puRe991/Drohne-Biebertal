"use server";
import { redirect } from "next/navigation";
import { getSession, verifyLogin } from "@/lib/auth";
import { getContent, saveContent } from "@/lib/content";
export async function loginAction(form: FormData) {
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");
  const user = await verifyLogin(email, password);
  if (!user) redirect("/admin?error=1");
  const session = await getSession();
  session.user = user;
  await session.save();
  redirect("/admin");
}
export async function logoutAction() {
  const s = await getSession();
  s.destroy();
  redirect("/admin");
}
export async function saveJsonAction(form: FormData) {
  const s = await getSession();
  if (!s.user) redirect("/admin?error=auth");
  const raw = String(form.get("json") || "");
  try {
    const parsed = JSON.parse(raw);
    saveContent(parsed);
  } catch {
    redirect("/admin?error=json");
  }
  redirect("/admin?saved=1");
}
export async function addIncidentAction(form: FormData) {
  const s = await getSession();
  if (!s.user) redirect("/admin");
  const c = getContent();
  const title = String(form.get("title") || "").trim();
  if (!title) redirect("/admin?error=title");
  c.incidents.unshift({
    id: title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    title,
    date: String(form.get("date") || new Date().toISOString().slice(0, 10)),
    place: String(form.get("place") || ""),
    category: String(form.get("category") || "Lageerkundung"),
    status: "abgeschlossen",
    duration: String(form.get("duration") || ""),
    image: String(
      form.get("image") ||
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    ),
    description: String(form.get("description") || ""),
  });
  saveContent(c);
  redirect("/admin?saved=1");
}

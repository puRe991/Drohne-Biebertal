import { z } from "zod";

const nonEmpty = z.string().trim().min(1, "Pflichtfeld darf nicht leer sein");
const imageUrl = z.string().trim().url("Bild muss eine gültige URL sein");

export const IncidentSchema = z.object({
  id: nonEmpty.regex(/^[a-z0-9-]+$/, "ID darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten"),
  title: nonEmpty,
  date: nonEmpty.regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein"),
  place: nonEmpty,
  category: nonEmpty,
  status: z.enum(["laufend", "abgeschlossen"]).or(nonEmpty),
  duration: z.string().trim(),
  image: imageUrl,
  description: nonEmpty,
});

export const SiteContentSchema = z.object({
  settings: z.object({
    siteName: nonEmpty,
    subtitle: nonEmpty,
    claim: nonEmpty,
    email: nonEmpty.email("Ungültige E-Mail-Adresse"),
    phone: nonEmpty,
    address: nonEmpty,
    socials: z.record(z.string().trim(), z.string().trim()),
  }),
  pages: z.object({
    heroHeadline: nonEmpty,
    heroKicker: nonEmpty,
    heroSubline: nonEmpty,
    ctaTitle: nonEmpty,
    ctaText: nonEmpty,
    training: nonEmpty,
    contactIntro: nonEmpty,
  }),
  areas: z.array(
    z.object({ title: nonEmpty, text: nonEmpty, icon: nonEmpty }),
  ).min(1),
  incidents: z.array(IncidentSchema),
  team: z.array(
    z.object({
      name: nonEmpty,
      role: nonEmpty,
      qualification: nonEmpty,
      order: z.coerce.number().int().nonnegative(),
      image: imageUrl,
    }),
  ),
  equipment: z.array(
    z.object({
      id: nonEmpty,
      name: nonEmpty,
      description: nonEmpty,
      image: imageUrl,
      features: z.array(nonEmpty).min(1),
    }),
  ).min(1),
  gallery: z.array(
    z.object({
      title: nonEmpty,
      category: nonEmpty,
      type: z.enum(["image", "video"]),
      url: imageUrl,
    }),
  ),
});

export type SiteContent = z.infer<typeof SiteContentSchema>;
export type Incident = z.infer<typeof IncidentSchema>;

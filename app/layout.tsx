import type { Metadata } from "next";
import "./styles.css";
import { Header, Footer } from "@/components/layout";
export const metadata: Metadata = {
  title: "Feuerwehr Biebertal – Fachgruppe Drohne",
  description:
    "Drohnen-Fachgruppe der Freiwilligen Feuerwehr Biebertal: Einsätze, Technik, Team und Kontakt.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

import Link from "next/link";
import { Phone } from "lucide-react";
import { getContent } from "@/lib/content";
const nav = [
  ["/", "Start"],
  ["/einsaetze", "Einsätze"],
  ["/technik", "Technik"],
  ["/team", "Team"],
  ["/ausbildung", "Ausbildung"],
  ["/galerie", "Galerie"],
  ["/kontakt", "Kontakt"],
];
export function Header() {
  const c = getContent();
  return (
    <header className="top">
      <Link className="brand" href="/">
        <div className="crest">⚒</div>
        <div>
          <b>{c.settings.siteName}</b>
          <span>{c.settings.subtitle}</span>
        </div>
      </Link>
      <nav>
        {nav.map(([h, l]) => (
          <Link key={h} href={h}>
            {l}
          </Link>
        ))}
      </nav>
      <a className="emergency" href="tel:112">
        <Phone size={20} />
        Notruf
        <br />
        <b>112</b>
      </a>
    </header>
  );
}
export function Footer() {
  const c = getContent();
  return (
    <footer className="footer">
      <div>
        <div className="brand footer-brand">
          <div className="crest">⚒</div>
          <div>
            <b>{c.settings.siteName}</b>
            <span>{c.settings.subtitle}</span>
          </div>
        </div>
        <p>{c.settings.claim}</p>
      </div>
      <div>
        <h3>Kontakt</h3>
        <p>{c.settings.address}</p>
        <p>{c.settings.email}</p>
        <p>{c.settings.phone}</p>
      </div>
      <div>
        <h3>Folge uns</h3>
        {Object.entries(c.settings.socials).map(([k, v]) => (
          <a key={k} href={v}>
            {k}
          </a>
        ))}
      </div>
      <div>
        <h3>Wichtige Links</h3>
        <Link href="/datenschutz">Datenschutzerklärung</Link>
        <Link href="/impressum">Impressum</Link>
        <Link href="/admin">Admin</Link>
      </div>
      <small>© 2026 Freiwillige Feuerwehr Biebertal – Fachgruppe Drohne</small>
    </footer>
  );
}

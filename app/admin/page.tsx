import { getContent } from "@/lib/content";
import { getSession } from "@/lib/auth";
import {
  addIncidentAction,
  loginAction,
  logoutAction,
  saveJsonAction,
} from "./actions";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session.user)
    return (
      <section className="admin">
        <div className="card" style={{ maxWidth: 480, margin: "60px auto" }}>
          <h1>Admin-Login</h1>
          <p>
            Initial: admin@feuerwehr-biebertal.local / Drohne112! – beim
            Live-Gang Hash per ENV setzen.
          </p>
          {sp.error && <p className="redtext">Login fehlgeschlagen.</p>}
          <form action={loginAction}>
            <input name="email" type="email" placeholder="E-Mail" required />
            <input
              name="password"
              type="password"
              placeholder="Passwort"
              required
            />
            <button className="btn red">Einloggen</button>
          </form>
          <p>
            <a href="/admin/reset">Passwort vergessen? (TODO Mock-Mail)</a>
          </p>
        </div>
      </section>
    );
  const content = getContent();
  return (
    <section className="admin">
      <div className="adminnav">
        <a href="#incidents">Einsätze</a>
        <a href="#json">Alle Inhalte</a>
        <form action={logoutAction}>
          <button>Logout</button>
        </form>
      </div>
      <h1>CMS Backend</h1>
      <p>
        Angemeldet als {session.user.email} ({session.user.role}). Inhalte
        werden direkt in <code>data/site.json</code> gespeichert. Für
        Produktion: Datenbank/Objektspeicher aktivieren.
      </p>
      {sp.saved && <p className="redtext">Gespeichert.</p>}
      <div id="incidents" className="card">
        <h2>Einsatz anlegen</h2>
        <form action={addIncidentAction} className="grid formgrid">
          <input name="title" placeholder="Titel" required />
          <input name="date" type="date" required />
          <input name="place" placeholder="Ort" />
          <select name="category">
            <option>Personensuche</option>
            <option>Lageerkundung</option>
            <option>Wärmebild</option>
            <option>Dokumentation</option>
          </select>
          <input name="duration" placeholder="Dauer" />
          <input name="image" placeholder="Bild-URL" />
          <textarea
            name="description"
            placeholder="Beschreibung"
            style={{ gridColumn: "1/-1" }}
          />
          <button className="btn red">Speichern</button>
        </form>
      </div>
      <div id="json" className="card" style={{ marginTop: 24 }}>
        <h2>Redaktionelle Inhalte bearbeiten</h2>
        <p>
          Dieses robuste JSON-Formular ist die Basis für alle Bereiche
          (Einsätze, Team, Technik, Galerie, Seiteninhalte, Einstellungen). Es
          kann später durch spezialisierte Drag&Drop-Formulare ersetzt werden.
        </p>
        <form action={saveJsonAction}>
          <textarea
            name="json"
            defaultValue={JSON.stringify(content, null, 2)}
          />
          <button className="btn red">Alle Inhalte speichern</button>
        </form>
      </div>
    </section>
  );
}

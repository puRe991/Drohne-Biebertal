import { getContent } from "@/lib/content";
export default function Page() {
  const c = getContent();
  return (
    <>
      <div className="page-hero">
        <h1>Kontakt</h1>
        <p>{c.pages.contactIntro}</p>
      </div>
      <section className="wrap grid mapcta">
        <form className="card">
          <input placeholder="Name" />
          <input placeholder="E-Mail" />
          <textarea placeholder="Nachricht" />
          <button className="btn red" type="button">
            Absenden (Demo)
          </button>
        </form>
        <div className="card">
          <h2>Kontaktdaten</h2>
          <p>{c.settings.address}</p>
          <p>{c.settings.email}</p>
          <p>{c.settings.phone}</p>
          <div className="mapbox">Karte / Anfahrt (TODO)</div>
        </div>
      </section>
    </>
  );
}

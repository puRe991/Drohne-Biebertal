import { getContent } from "@/lib/content";
export default function Page() {
  return (
    <>
      <div className="page-hero">
        <h1>Ausbildung</h1>
      </div>
      <section className="wrap card">
        <p>{getContent().pages.training}</p>
        <ul className="features">
          <li>Luftrecht und Datenschutz</li>
          <li>Flugpraxis und Notverfahren</li>
          <li>Wärmebildauswertung</li>
          <li>Einsatzdokumentation</li>
        </ul>
      </section>
    </>
  );
}

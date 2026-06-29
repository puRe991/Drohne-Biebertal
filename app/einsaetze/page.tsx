import Link from "next/link";
import Image from "next/image";
import { getContent, formatDate } from "@/lib/content";
export default function Page() {
  const c = getContent();
  return (
    <>
      <div className="page-hero">
        <h1>Einsätze</h1>
        <p>
          Filterbare Einsatzliste (Kategorie/Sortierung im CMS erweiterbar).
        </p>
      </div>
      <section className="wrap list">
        {c.incidents.map((i) => (
          <article className="card incident" key={i.id}>
            <Image src={i.image} width={220} height={140} alt="" />
            <div>
              <span className="badge">{i.category}</span>
              <h2>
                <Link href={`/einsaetze/${i.id}`}>{i.title}</Link>
              </h2>
              <p>
                <b>{formatDate(i.date)}</b> · {i.place} · {i.status}
              </p>
              <p>{i.description}</p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

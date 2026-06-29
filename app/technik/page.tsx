import Image from "next/image";
import { getContent } from "@/lib/content";
export default function Page() {
  return (
    <>
      <div className="page-hero">
        <h1>Technik</h1>
        <p>Drohnen, Sensorik und Zubehör der Fachgruppe.</p>
      </div>
      <section className="wrap grid cards4">
        {getContent().equipment.map((e) => (
          <article className="card" key={e.id}>
            <Image
              className="equip-img"
              src={e.image}
              width={500}
              height={250}
              alt={e.name}
            />
            <h2>{e.name}</h2>
            <p>{e.description}</p>
            <ul className="features">
              {e.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </>
  );
}

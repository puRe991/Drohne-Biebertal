import Image from "next/image";
import { getContent } from "@/lib/content";
export default function Page() {
  return (
    <>
      <div className="page-hero">
        <h1>Team</h1>
        <p>Platzhalterdaten – Veröffentlichung nur mit Einwilligung.</p>
      </div>
      <section className="wrap grid cards4">
        {getContent()
          .team.sort((a, b) => a.order - b.order)
          .map((m) => (
            <article
              className="card"
              style={{ textAlign: "center" }}
              key={m.name}
            >
              <Image
                className="avatar"
                src={m.image}
                width={120}
                height={120}
                alt={m.name}
              />
              <h2>{m.name}</h2>
              <p>
                {m.role}
                <br />
                {m.qualification}
              </p>
            </article>
          ))}
      </section>
    </>
  );
}

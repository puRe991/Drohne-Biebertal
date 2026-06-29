import Image from "next/image";
import { getContent } from "@/lib/content";
export default function Page() {
  return (
    <>
      <div className="page-hero">
        <h1>Galerie</h1>
      </div>
      <section className="wrap grid cards4 gallery">
        {getContent().gallery.map((g) => (
          <article className="card" key={g.title}>
            <Image src={g.url} width={500} height={300} alt={g.title} />
            <h2>{g.title}</h2>
            <p>{g.category}</p>
          </article>
        ))}
      </section>
    </>
  );
}

import Image from "next/image";
import { notFound } from "next/navigation";
import { getContent, formatDate } from "@/lib/content";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const i = getContent().incidents.find((x) => x.id === id);
  if (!i) notFound();
  return (
    <>
      <div className="page-hero">
        <h1>{i.title}</h1>
        <p>
          {formatDate(i.date)} · {i.place}
        </p>
      </div>
      <section className="wrap card">
        <Image
          className="equip-img"
          src={i.image}
          width={1000}
          height={420}
          alt=""
        />
        <p>
          <span className="badge">{i.category}</span> Status: {i.status} ·
          Dauer: {i.duration}
        </p>
        <p>{i.description}</p>
      </section>
    </>
  );
}

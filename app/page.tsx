import Image from "next/image";
import Link from "next/link";
import { icons } from "@/components/icons";
import { formatDate, getContent } from "@/lib/content";

export default function Home() {
  const content = getContent();
  const primaryEquipment = content.equipment[0];

  return (
    <>
      <section className="hero">
        <div>
          <div className="kicker">{content.pages.heroKicker}</div>
          <h1>{content.pages.heroHeadline}</h1>
          <p>{content.pages.heroSubline}</p>
          <p>
            <Link className="btn red" href="/technik">
              Mehr erfahren
            </Link>{" "}
            <Link className="btn" href="/einsaetze">
              Aktuelle Einsätze
            </Link>
          </p>
        </div>
      </section>

      <section className="wrap">
        <h2 className="section-title">Unsere Einsatzbereiche</h2>
        <div className="grid cards4">
          {content.areas.map((area) => {
            const Icon = icons[area.icon as keyof typeof icons];
            return (
              <article className="card area" key={area.title}>
                <Icon size={52} />
                <div>
                  <h3>{area.title}</h3>
                  <p>{area.text}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="wrap grid cols3">
        <div className="card">
          <h2 className="section-title">Aktuelle Einsätze</h2>
          {content.incidents.map((incident) => (
            <Link
              className="incident"
              href={`/einsaetze/${incident.id}`}
              key={incident.id}
            >
              <Image src={incident.image} width={160} height={100} alt="" />
              <div>
                <span className="badge">EINSATZ</span>
                <small style={{ float: "right" }}>
                  {formatDate(incident.date)}
                </small>
                <b style={{ display: "block" }}>{incident.title}</b>
                <span>{incident.place}</span>
                <p>{incident.description}</p>
              </div>
            </Link>
          ))}
          <Link className="redtext" href="/einsaetze">
            Alle Einsätze ansehen →
          </Link>
        </div>

        <div className="card">
          <h2 className="section-title">Unser Team</h2>
          <div className="grid teamgrid">
            {content.team.map((member) => (
              <div key={member.name}>
                <Image
                  className="avatar"
                  src={member.image}
                  width={100}
                  height={100}
                  alt={member.name}
                />
                <b>{member.name}</b>
                <p>
                  {member.role}
                  <br />
                  {member.qualification}
                </p>
              </div>
            ))}
          </div>
          <Link className="redtext" href="/team">
            Mehr über unser Team →
          </Link>
        </div>

        <div className="card">
          <h2 className="section-title">Unsere Technik</h2>
          <Image
            className="equip-img"
            src={primaryEquipment.image}
            width={500}
            height={250}
            alt={primaryEquipment.name}
          />
          <h3>{primaryEquipment.name}</h3>
          <ul className="features">
            {primaryEquipment.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <Link className="redtext" href="/technik">
            Gesamte Ausrüstung ansehen →
          </Link>
        </div>
      </section>

      <section className="wrap grid mapcta">
        <div className="mapbox">
          <h2 className="section-title">Einsatzgebiet Biebertal</h2>
          <div className="outline-map">
            Krumbach · Frankenbach · Rodheim-Bieber · Fellingshausen · Vetzberg
          </div>
        </div>
        <div className="cta">
          <h2>{content.pages.ctaTitle}</h2>
          <p>{content.pages.ctaText}</p>
          <h3>Komm in unser Team!</h3>
          <Link className="btn" href="/kontakt">
            Jetzt mitmachen
          </Link>
        </div>
      </section>
    </>
  );
}

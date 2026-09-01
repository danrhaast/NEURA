/* eslint-disable @next/next/no-img-element */

/* O texto e a foto vêm do banco (painel → Sobre Nós). Os valores padrão aqui
   são só a rede de segurança para o caso de o registro estar vazio. */
export default function Sobre({ sobre }) {
  const p1 = sobre?.p1?.trim();
  const p2 = sobre?.p2?.trim();
  const foto = sobre?.foto?.trim();
  const fotoAlt = sobre?.fotoAlt?.trim() || 'A banda Neura';

  return (
    <section className="n-section" id="sobre">
      <div className="n-container">
        <div className="about">

          <div className="about__frame n-reveal">
            <div className="n-hud-frame">
              <div className="n-hud-frame__inner about__photo">
                {foto
                  ? <img src={foto} alt={fotoAlt} className="about__img" loading="lazy" />
                  : <span>Foto da banda</span>}
              </div>
            </div>
          </div>

          <div className="about__text n-reveal" data-delay="1">
            {p1 && <p className="n-body">{p1}</p>}
            {p2 && <p className="n-body n-mt-5">{p2}</p>}
          </div>

        </div>
      </div>
    </section>
  );
}

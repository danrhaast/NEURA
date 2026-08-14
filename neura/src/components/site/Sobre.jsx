export default function Sobre() {
  return (
    <section className="n-section" id="sobre">
      <div className="n-container">
        <div className="about">

          <div className="about__frame n-reveal">
            <div className="n-hud-frame">
              <div className="n-hud-frame__inner about__photo">
                <span>Foto da banda</span>
              </div>
            </div>
          </div>

          <div className="about__text n-reveal" data-delay="1">
            <p className="n-body">
              A Neura é uma banda que transforma o metal em uma experiência
              cinematográfica. Unindo influências que vão do heavy metal clássico ao
              metal contemporâneo, criamos uma identidade própria onde peso, melodia
              e atmosfera caminham juntos.
            </p>
            <p className="n-body n-mt-5">
              Inspirada pelo universo cyberpunk, nossa música retrata os conflitos do
              mundo moderno a perda da humanidade e as batalhas internas que cada
              pessoa enfrenta. Não contamos histórias sobre um futuro distante,
              falamos da realidade, apenas através de uma nova lente.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}

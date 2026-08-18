/* eslint-disable @next/next/no-img-element */

export default function Hero() {
  return (
    <section className="hero n-relative" id="topo">

      <img src="/assets/hud-bracket.svg" alt="" className="hero__hud hero__hud--left"  aria-hidden="true" />
      <img src="/assets/hud-bracket.svg" alt="" className="hero__hud hero__hud--right" aria-hidden="true" />

      <div className="hero__stage">
        <div className="hero__art">
          <img
            src="/assets/rose.webp"
            alt=""
            className="hero__rose"
            width={640}
            height={800}
            fetchPriority="high"
          />
          <img src="/assets/emblem.webp" alt="Neura" className="hero__emblem" />
        </div>
      </div>

      <a href="#shows" className="hero__scroll" aria-label="Rolar para baixo">
        <span className="n-hud">Role</span>
        <i />
      </a>
    </section>
  );
}

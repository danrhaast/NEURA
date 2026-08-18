'use client';

import { useEffect, useRef } from 'react';

export default function Poemas({ poemas = [] }) {
  const viewport = useRef(null);

  function deslizar(dir) {
    const vp = viewport.current;
    if (!vp) return;

    const item = vp.querySelector('.n-carousel__item');
    if (!item) return;

    const gap = parseFloat(getComputedStyle(vp).gap) || 24;
    vp.scrollBy({ left: dir * (item.offsetWidth + gap), behavior: 'smooth' });
  }

  // centraliza no card do meio ao montar
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;

    const itens = vp.querySelectorAll('.n-carousel__item');
    if (itens.length > 2) {
      const meio = itens[Math.floor(itens.length / 2)];
      vp.scrollLeft = meio.offsetLeft - (vp.clientWidth - meio.offsetWidth) / 2;
    }
  }, [poemas.length]);

  // arrastar com o mouse
  useEffect(() => {
    const vp = viewport.current;
    if (!vp) return;

    let pressionado = false, xInicial = 0, scrollInicial = 0;

    const aoPressionar = (e) => {
      pressionado = true;
      xInicial = e.pageX;
      scrollInicial = vp.scrollLeft;
      vp.style.cursor = 'grabbing';
    };
    const aoSoltar = () => { pressionado = false; vp.style.cursor = ''; };
    const aoMover = (e) => {
      if (!pressionado) return;
      e.preventDefault();
      vp.scrollLeft = scrollInicial - (e.pageX - xInicial);
    };

    vp.addEventListener('mousedown', aoPressionar);
    vp.addEventListener('mousemove', aoMover);
    window.addEventListener('mouseup', aoSoltar);

    return () => {
      vp.removeEventListener('mousedown', aoPressionar);
      vp.removeEventListener('mousemove', aoMover);
      window.removeEventListener('mouseup', aoSoltar);
    };
  }, []);

  function aoTeclar(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); deslizar(1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); deslizar(-1); }
  }

  return (
    <section className="n-section poemas n-relative" id="poemas">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/contour.svg" alt="" className="poemas__bg" aria-hidden="true" />

      <div className="n-container n-relative">

        <h2 className="n-title n-reveal">Poemas</h2>

        <div className="n-carousel n-mt-6 n-reveal" data-delay="1">

          <button
            className="n-carousel__nav n-carousel__nav--prev"
            onClick={() => deslizar(-1)}
            aria-label="Anterior"
          >‹</button>

          <div
            ref={viewport}
            className="n-carousel__viewport"
            onKeyDown={aoTeclar}
          >
            {poemas.map((p, i) => (
              <article className="n-carousel__item poema" key={p.id ?? i} tabIndex={0}>
                <h3 className="poema__title">{p.titulo}</h3>
                <p className="poema__body">
                  {String(p.texto || '').split('\n').map((linha, k, arr) => (
                    <span key={k}>
                      {linha}
                      {k < arr.length - 1 && <br />}
                    </span>
                  ))}
                </p>
                <span className="poema__num">{String(i + 1).padStart(2, '0')}</span>
              </article>
            ))}
          </div>

          <button
            className="n-carousel__nav n-carousel__nav--next"
            onClick={() => deslizar(1)}
            aria-label="Próximo"
          >›</button>

        </div>
      </div>
    </section>
  );
}

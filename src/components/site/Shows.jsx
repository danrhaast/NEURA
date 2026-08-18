'use client';

import { useEffect, useRef, useState } from 'react';

export default function Shows({ progresso = 0 }) {
  const alvo = Math.max(0, Math.min(100, Number(progresso) || 0));
  const [valor, setValor] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function animar() {
      if (alvo === 0) { setValor(0); return; }

      const inicio = performance.now();
      const dur = 1200;

      function passo(agora) {
        const p = Math.min((agora - inicio) / dur, 1);
        setValor(Math.round(alvo * p));
        if (p < 1) requestAnimationFrame(passo);
      }
      requestAnimationFrame(passo);
    }

    if (!('IntersectionObserver' in window)) { animar(); return; }

    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) { animar(); obs.disconnect(); }
      },
      { threshold: 0.4 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [alvo]);

  return (
    <section className="n-section n-section--tight" id="shows">
      <div className="n-container">

        <h2 className="n-title n-reveal">Shows em breve...</h2>

        <div className="n-progress n-mt-6 n-reveal" data-delay="1">
          <div
            ref={ref}
            className="n-progress__track"
            role="progressbar"
            aria-valuenow={alvo}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da agenda de shows"
          >
            <div className="n-progress__fill" style={{ '--p': `${alvo}%` }} />
          </div>
          <span className="n-progress__value">{valor}%</span>
        </div>

      </div>
    </section>
  );
}

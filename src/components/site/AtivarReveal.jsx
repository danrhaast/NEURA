'use client';

import { useEffect } from 'react';

/**
 * Liga as animações de entrada: observa todo elemento .n-reveal e adiciona
 * .is-visible quando ele entra na tela. Montado uma única vez pela página.
 */
export default function AtivarReveal() {
  useEffect(() => {
    const alvos = document.querySelectorAll('.n-reveal:not(.is-visible)');

    if (!('IntersectionObserver' in window)) {
      alvos.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const obs = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
    );

    alvos.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return null;
}

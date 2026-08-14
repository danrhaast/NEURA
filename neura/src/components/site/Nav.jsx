'use client';

import { useEffect, useState } from 'react';

const LINKS = [
  ['shows',  'Shows'],
  ['sobre',  'Sobre Nós'],
  ['poemas', 'Poemas'],
  ['lore',   'Lore'],
  ['videos', 'Vídeos'],
  ['redes',  'Redes'],
];

export default function Nav() {
  const [aberto, setAberto]   = useState(false);
  const [rolou, setRolou]     = useState(false);
  const [ativo, setAtivo]     = useState('');

  useEffect(() => {
    function aoRolar() {
      setRolou(window.scrollY > 20);

      // marca o link da seção visível
      const limite = window.scrollY + window.innerHeight * 0.35;
      let atual = '';
      for (const [id] of LINKS) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= limite) atual = id;
      }
      setAtivo(atual);
    }

    window.addEventListener('scroll', aoRolar, { passive: true });
    aoRolar();
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  // fecha o menu com ESC
  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(e) { if (e.key === 'Escape') setAberto(false); }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto]);

  return (
    <header className={'nav' + (rolou ? ' is-scrolled' : '')}>
      <div className="nav__inner">

        <a href="#topo" className="nav__logo" aria-label="Neura — início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-neura.webp" alt="Neura" />
        </a>

        <nav
          id="menu"
          className={'nav__menu' + (aberto ? ' is-open' : '')}
          aria-label="Menu principal"
        >
          <ul className="nav__list">
            {LINKS.map(([id, rotulo]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className={'nav__link' + (ativo === id ? ' is-active' : '')}
                  onClick={() => setAberto(false)}
                >
                  {rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="nav__right">
          <a href="#redes" className="n-avatar" aria-label="Perfil / redes">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
            </svg>
          </a>

          <button
            className={'nav__toggle' + (aberto ? ' is-open' : '')}
            aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={aberto}
            aria-controls="menu"
            onClick={() => setAberto((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>

      </div>
    </header>
  );
}

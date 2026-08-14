const REDES = [
  {
    nome: 'TikTok',
    href: 'https://www.tiktok.com/@neuraoficialband',
    icone: (
      <path d="M16.5 2h-3v13a2.5 2.5 0 1 1-2.5-2.5c.2 0 .4 0 .5.1V9.5A5.5 5.5 0 1 0 16.5 15V8.6c1 .7 2.2 1.1 3.5 1.1V6.7c-1.9 0-3.5-1.5-3.5-3.4V2z" />
    ),
  },
  {
    nome: 'Instagram',
    href: 'https://www.instagram.com/banda_neura',
    icone: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.4" cy="6.6" r="1.3" />
      </>
    ),
  },
  {
    nome: 'YouTube',
    href: '#videos',
    icone: (
      <path d="M22.5 7.2a2.7 2.7 0 0 0-1.9-1.9C18.9 4.8 12 4.8 12 4.8s-6.9 0-8.6.5A2.7 2.7 0 0 0 1.5 7.2C1 8.9 1 12 1 12s0 3.1.5 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 8.6.5 8.6.5s6.9 0 8.6-.5a2.7 2.7 0 0 0 1.9-1.9c.5-1.7.5-4.8.5-4.8s0-3.1-.5-4.8zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z" />
    ),
  },
];

export default function Redes() {
  return (
    <section className="n-section n-section--tight redes" id="redes">
      <div className="n-container n-text-center">
        <ul className="redes__list n-reveal">
          {REDES.map((r) => {
            const externo = r.href.startsWith('http');
            return (
              <li key={r.nome}>
                <a
                  href={r.href}
                  {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="n-social"
                  aria-label={`${r.nome} da Neura`}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    {r.icone}
                  </svg>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

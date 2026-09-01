/* Ícones do painel. Traçado desenhado sobre a grade de 24, para todos terem o
   mesmo peso visual. Cada painel escolhe o seu pelo campo `icone` em
   src/lib/papeis.js. */

const FORMAS = {
  painel: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  texto: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h10M7 13h10M7 17h6" />
    </>
  ),
  poema: (
    <>
      <path d="M4 4h9a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4z" />
      <path d="M20 7v13a2.5 2.5 0 0 0-2.5-2.5H16" />
    </>
  ),
  video: (
    <>
      <rect x="2.5" y="5" width="14" height="14" rx="2.5" />
      <path d="M16.5 10.5 21.5 7.5v9l-5-3z" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2c2.1.7 3.5 2.5 3.5 5.8" />
    </>
  ),
  visitas: (
    <>
      <path d="M3 17.5 9 11l4 4 8-8.5" />
      <path d="M15 6.5h6v6" />
    </>
  ),
  sair: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8 6 12l4 4M6 12h9" />
    </>
  ),
};

export default function Icone({ nome, className = '' }) {
  const forma = FORMAS[nome];
  if (!forma) return null;

  return (
    <svg
      className={`icone ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {forma}
    </svg>
  );
}

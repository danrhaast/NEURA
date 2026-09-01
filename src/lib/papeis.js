/* ==========================================================================
   PAPEIS.JS — quem pode ver o quê

   Uma lista só de painéis, lida pelo dashboard, pelo menu lateral e pela
   checagem de acesso do servidor. Acrescentar um painel aqui já o faz
   aparecer no menu e no dashboard; só falta criar a página.

   Sem imports de `node:` — este módulo também roda no navegador.
   ========================================================================== */

export const PAPEIS = {
  dono:   { nome: 'Dono',   descricao: 'Edita tudo e administra as contas do painel.' },
  editor: { nome: 'Editor', descricao: 'Edita o conteúdo do site, sem acesso às contas.' },
};

export function ehPapelValido(papel) {
  return Object.hasOwn(PAPEIS, papel);
}

/* `papeis` vazio = liberado para qualquer conta autenticada. */
export const PAINEIS = [
  {
    id: 'shows',
    href: '/admin/shows',
    nome: 'Shows',
    resumo: 'Barra de progresso da agenda na home.',
    icone: 'calendario',
    papeis: [],
  },
  {
    id: 'sobre',
    href: '/admin/sobre',
    nome: 'Sobre Nós',
    resumo: 'Texto de apresentação e foto da banda.',
    icone: 'texto',
    papeis: [],
  },
  {
    id: 'poemas',
    href: '/admin/poemas',
    nome: 'Poemas',
    resumo: 'Cards do carrossel de poemas.',
    icone: 'poema',
    papeis: [],
  },
  {
    id: 'videos',
    href: '/admin/videos',
    nome: 'Vídeos',
    resumo: 'Grade de vídeos com capa do YouTube.',
    icone: 'video',
    papeis: [],
  },
  {
    id: 'usuarios',
    href: '/admin/usuarios',
    nome: 'Usuários',
    resumo: 'Contas com acesso a este painel.',
    icone: 'usuarios',
    papeis: ['dono'],
  },
];

export function podeVer(painel, papel) {
  return !painel.papeis.length || painel.papeis.includes(papel);
}

export function paineisDe(papel) {
  return PAINEIS.filter((p) => podeVer(p, papel));
}

/** O painel que responde por uma URL do admin, ou null para o dashboard. */
export function painelDaRota(caminho) {
  return PAINEIS.find((p) => caminho === p.href || caminho.startsWith(`${p.href}/`)) ?? null;
}

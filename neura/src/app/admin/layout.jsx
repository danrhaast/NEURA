/* O painel é pré-renderizado como página estática e, sem isto, a tela de login
   entra no índice dos buscadores. Não protege nada — a proteção real é a sessão
   conferida no servidor — apenas mantém o painel fora das buscas. */

export const metadata = {
  title: 'Painel — NEURA',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }) {
  return children;
}

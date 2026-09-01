/* ==========================================================================
   Moldura e porta de entrada do painel.

   A checagem de sessão acontece aqui, no servidor, antes de qualquer tela
   filha renderizar: sem sessão, o que vai para o navegador é só o formulário
   de login — nenhum dado do painel chega junto.

   Antes disso o /admin era estático e perguntava por fetch se havia sessão,
   o que fazia a tela piscar um "Verificando sessão..." em todo carregamento.

   O `noindex` não protege nada — a proteção é a sessão. Ele só mantém o
   painel fora das buscas.
   ========================================================================== */

import { sessao } from '@/lib/auth';
import Portao from '@/components/admin/Portao';
import Casca from '@/components/admin/Casca';

export const metadata = {
  title: 'Painel — NEURA',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const usuario = await sessao();

  if (!usuario) return <Portao />;

  return <Casca usuario={usuario}>{children}</Casca>;
}

import { sessao } from '@/lib/auth';
import { lerConteudo } from '@/lib/db';
import PainelShows from '@/components/admin/PainelShows';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shows — Painel NEURA' };

export default async function Page() {
  // Roda em paralelo ao layout: sem sessão, não vale ir ao banco.
  if (!(await sessao())) return null;

  const { progressoShows } = await lerConteudo();
  return <PainelShows inicial={progressoShows} />;
}

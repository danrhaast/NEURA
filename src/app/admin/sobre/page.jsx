import { sessao } from '@/lib/auth';
import { lerSobre } from '@/lib/db';
import PainelSobre from '@/components/admin/PainelSobre';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sobre Nós — Painel NEURA' };

export default async function Page() {
  // Roda em paralelo ao layout: sem sessão, não vale ir ao banco.
  if (!(await sessao())) return null;

  return <PainelSobre inicial={await lerSobre()} />;
}

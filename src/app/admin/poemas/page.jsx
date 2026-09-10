import { sessao } from '@/lib/auth';
import { listarPoemas } from '@/lib/db';
import PainelPoemas from '@/components/admin/PainelPoemas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Poemas — Painel NEURA' };

export default async function Page() {
  // Roda em paralelo ao layout: sem sessão, não vale ir ao banco.
  if (!(await sessao())) return null;

  return <PainelPoemas inicial={await listarPoemas()} />;
}

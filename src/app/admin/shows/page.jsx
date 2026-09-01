import { lerConteudo } from '@/lib/db';
import PainelShows from '@/components/admin/PainelShows';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shows — Painel NEURA' };

export default function Page() {
  const { progressoShows } = lerConteudo();
  return <PainelShows inicial={progressoShows} />;
}

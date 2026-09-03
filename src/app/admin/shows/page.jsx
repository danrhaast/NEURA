import { lerConteudo } from '@/lib/db';
import PainelShows from '@/components/admin/PainelShows';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shows — Painel NEURA' };

export default async function Page() {
  const { progressoShows } = await lerConteudo();
  return <PainelShows inicial={progressoShows} />;
}

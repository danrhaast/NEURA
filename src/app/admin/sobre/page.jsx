import { lerSobre } from '@/lib/db';
import PainelSobre from '@/components/admin/PainelSobre';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sobre Nós — Painel NEURA' };

export default async function Page() {
  return <PainelSobre inicial={await lerSobre()} />;
}

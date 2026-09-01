import { lerSobre } from '@/lib/db';
import PainelSobre from '@/components/admin/PainelSobre';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sobre Nós — Painel NEURA' };

export default function Page() {
  return <PainelSobre inicial={lerSobre()} />;
}

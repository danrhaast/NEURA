import { listarPoemas } from '@/lib/db';
import PainelPoemas from '@/components/admin/PainelPoemas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Poemas — Painel NEURA' };

export default function Page() {
  return <PainelPoemas inicial={listarPoemas()} />;
}

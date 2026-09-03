import { listarPoemas } from '@/lib/db';
import PainelPoemas from '@/components/admin/PainelPoemas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Poemas — Painel NEURA' };

export default async function Page() {
  return <PainelPoemas inicial={await listarPoemas()} />;
}

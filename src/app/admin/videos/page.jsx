import { listarVideos } from '@/lib/db';
import PainelVideos from '@/components/admin/PainelVideos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vídeos — Painel NEURA' };

export default function Page() {
  return <PainelVideos inicial={listarVideos()} />;
}

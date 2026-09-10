import { sessao } from '@/lib/auth';
import { listarVideos } from '@/lib/db';
import PainelVideos from '@/components/admin/PainelVideos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vídeos — Painel NEURA' };

export default async function Page() {
  // Roda em paralelo ao layout: sem sessão, não vale ir ao banco.
  if (!(await sessao())) return null;

  return <PainelVideos inicial={await listarVideos()} />;
}

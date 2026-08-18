/* ==========================================================================
   GET  /api/conteudo   → conteúdo público (aberto)
   PUT  /api/conteudo   → grava tudo de uma vez (exige sessão)
   ========================================================================== */

import { lerConteudo, salvarConteudo } from '@/lib/db';
import { autenticado, naoAutorizado } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json(lerConteudo());
  } catch (e) {
    console.error('GET /api/conteudo', e);
    return Response.json({ erro: 'Falha ao ler o conteúdo' }, { status: 500 });
  }
}

export async function PUT(req) {
  if (!(await autenticado())) return naoAutorizado();

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return Response.json({ erro: 'JSON inválido' }, { status: 400 });
  }

  const { poemas, videos, progressoShows } = corpo ?? {};

  if (!Array.isArray(poemas) || !Array.isArray(videos)) {
    return Response.json({ erro: 'Envie "poemas" e "videos" como listas' }, { status: 400 });
  }

  if (poemas.length > 200 || videos.length > 200) {
    return Response.json({ erro: 'Limite de 200 itens por lista' }, { status: 400 });
  }

  try {
    return Response.json({ ok: true, ...salvarConteudo({ poemas, videos, progressoShows }) });
  } catch (e) {
    console.error('PUT /api/conteudo', e);
    return Response.json({ erro: 'Falha ao gravar' }, { status: 500 });
  }
}

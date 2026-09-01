/* ==========================================================================
   GET  /api/conteudo   → conteúdo público (aberto)
   PUT  /api/conteudo   → grava (exige sessão)

   O PUT aceita payload parcial: cada painel manda só a sua seção e o que não
   vier fica como está. Assim dois painéis abertos ao mesmo tempo não
   sobrescrevem um ao outro com dados que nem carregaram.
   ========================================================================== */

import { lerConteudo, salvarConteudo } from '@/lib/db';
import { exigirSessao } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMITE_ITENS = 200;

export async function GET() {
  try {
    return Response.json(lerConteudo());
  } catch (e) {
    console.error('GET /api/conteudo', e);
    return Response.json({ erro: 'Falha ao ler o conteúdo' }, { status: 500 });
  }
}

export async function PUT(req) {
  const { erro: semSessao } = await exigirSessao();
  if (semSessao) return semSessao;

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return Response.json({ erro: 'JSON inválido' }, { status: 400 });
  }

  const { poemas, videos, progressoShows, sobre } = corpo ?? {};

  if (poemas === undefined && videos === undefined && progressoShows === undefined && sobre === undefined) {
    return Response.json({ erro: 'Nada para gravar' }, { status: 400 });
  }

  for (const [nome, lista] of [['poemas', poemas], ['videos', videos]]) {
    if (lista === undefined) continue;

    if (!Array.isArray(lista)) {
      return Response.json({ erro: `"${nome}" precisa ser uma lista` }, { status: 400 });
    }
    if (lista.length > LIMITE_ITENS) {
      return Response.json({ erro: `Limite de ${LIMITE_ITENS} itens por lista` }, { status: 400 });
    }
  }

  if (sobre !== undefined && (typeof sobre !== 'object' || sobre === null || Array.isArray(sobre))) {
    return Response.json({ erro: '"sobre" precisa ser um objeto' }, { status: 400 });
  }

  try {
    return Response.json({ ok: true, ...salvarConteudo({ poemas, videos, progressoShows, sobre }) });
  } catch (e) {
    console.error('PUT /api/conteudo', e);
    return Response.json({ erro: 'Falha ao gravar' }, { status: 500 });
  }
}

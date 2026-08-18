/* ==========================================================================
   POST /api/auth/login   { senha }  → abre a sessão
   ========================================================================== */

import { conferirSenha, abrirSessao } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Freio simples contra força bruta, por IP e em memória.
// Reinicia quando o servidor reinicia — suficiente para um painel de banda.
const tentativas = new Map();
const LIMITE = 8;
const JANELA = 10 * 60 * 1000; // 10 min

/* Sem poda o Map só cresce: entradas de IPs que nunca mais voltam ficam para
   sempre, já que a remoção só acontece em login bem-sucedido. */
function podarVencidos(agora) {
  for (const [chave, reg] of tentativas) {
    if (agora - reg.desde > JANELA) tentativas.delete(chave);
  }
}

function excedeu(ip) {
  const agora = Date.now();

  if (tentativas.size > 1000) podarVencidos(agora);

  const reg = tentativas.get(ip);

  if (!reg || agora - reg.desde > JANELA) {
    tentativas.set(ip, { n: 1, desde: agora });
    return false;
  }

  reg.n += 1;
  return reg.n > LIMITE;
}

export async function POST(req) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'local';

  if (excedeu(ip)) {
    return Response.json(
      { erro: 'Muitas tentativas. Aguarde 10 minutos.' },
      { status: 429 }
    );
  }

  const hash = process.env.ADMIN_SENHA_HASH;
  if (!hash) {
    console.error('ADMIN_SENHA_HASH não configurado no .env.local');
    return Response.json(
      { erro: 'Servidor sem senha configurada. Rode: npm run senha' },
      { status: 500 }
    );
  }

  let senha;
  try {
    ({ senha } = await req.json());
  } catch {
    return Response.json({ erro: 'JSON inválido' }, { status: 400 });
  }

  if (typeof senha !== 'string' || !conferirSenha(senha, hash)) {
    return Response.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }

  tentativas.delete(ip);
  await abrirSessao();

  return Response.json({ ok: true });
}

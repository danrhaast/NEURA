/* ==========================================================================
   POST /api/acesso   → registra uma visita da página pública

   Rota aberta, chamada pelo navegador de quem visita o site. O dashboard do
   painel lê o que ela grava.

   O que NÃO é guardado: IP, user-agent, URL completa de origem. O campo
   `visitante` é um HMAC de (IP + user-agent + data) — troca sozinho toda
   meia-noite, então dá para contar visitantes únicos do dia sem manter um
   identificador durável de ninguém. Da origem fica só o domínio.
   ========================================================================== */

import { createHmac } from 'node:crypto';

import { registrarVisita, podarAcessos } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Uma visita gravada é uma escrita em disco, e a rota é pública. Sem teto,
   um laço de fetch enche o banco — que é o mesmo arquivo do conteúdo do site
   e o que precisa caber no backup. */
const LIMITE_HORA = 200;
const JANELA      = 60 * 60 * 1000;

const porVisitante = new Map();

let ultimaPoda = 0;
const INTERVALO_PODA = 24 * 60 * 60 * 1000;

function excedeu(chave, agora) {
  if (porVisitante.size > 5000) {
    for (const [k, reg] of porVisitante) {
      if (agora - reg.desde > JANELA) porVisitante.delete(k);
    }
  }

  const reg = porVisitante.get(chave);
  if (!reg || agora - reg.desde > JANELA) {
    porVisitante.set(chave, { n: 1, desde: agora });
    return false;
  }

  reg.n += 1;
  return reg.n > LIMITE_HORA;
}

function hashVisitante(ip, ua) {
  const hoje = new Date().toISOString().slice(0, 10);
  const chave = process.env.SESSAO_SEGREDO || 'neura-sem-segredo';
  return createHmac('sha256', chave).update(`${ip}|${ua}|${hoje}`).digest('hex').slice(0, 32);
}

/* Da URL de origem interessa o domínio: "instagram.com" responde de onde veio
   a visita sem arrastar junto o caminho e os parâmetros da página anterior. */
function dominio(url) {
  try {
    const { hostname } = new URL(String(url));
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const ROBO = /bot|crawler|spider|crawling|headless|preview|monitor|curl|wget|python-requests/i;

export async function POST(req) {
  const ua = req.headers.get('user-agent') ?? '';

  // Buscador e checador de link não são visita. Bots educados se identificam;
  // os que não se identificam raramente rodam JavaScript, e esta rota só é
  // chamada pelo navegador depois que a página carrega.
  if (ROBO.test(ua)) return Response.json({ ok: true, ignorado: true });

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'local';

  const agora = Date.now();
  const visitante = hashVisitante(ip, ua);

  if (excedeu(visitante, agora)) {
    return Response.json({ ok: true, ignorado: true });
  }

  let corpo = {};
  try {
    corpo = (await req.json()) ?? {};
  } catch {
    // corpo ausente ou inválido: ainda vale registrar a visita da home
  }

  const caminho = String(corpo.caminho ?? '/').slice(0, 200);

  // O painel não é público e não entra na métrica do site.
  if (caminho.startsWith('/admin')) return Response.json({ ok: true, ignorado: true });

  try {
    registrarVisita({ caminho, referencia: dominio(corpo.referencia), visitante });

    if (agora - ultimaPoda > INTERVALO_PODA) {
      ultimaPoda = agora;
      podarAcessos();
    }
  } catch (e) {
    // Métrica nunca deve quebrar a visita de quem está no site.
    console.error('POST /api/acesso', e);
  }

  return Response.json({ ok: true });
}

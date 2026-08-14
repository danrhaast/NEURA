/* ==========================================================================
   AUTH.JS — autenticação do painel

   Diferente da versão estática antiga, agora a senha é verificada NO
   SERVIDOR. O navegador nunca recebe a senha nem o hash.

   - A senha é guardada como hash scrypt em ADMIN_SENHA_HASH (.env.local).
   - O login devolve um cookie httpOnly assinado com HMAC-SHA256.
   - O cookie é inacessível ao JavaScript da página (protege contra XSS).

   Gere o hash com:  npm run senha
   ========================================================================== */

import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE   = 'neura_sessao';
const DURACAO  = 60 * 60 * 8; // 8 horas


/* ==========================================================================
   SENHA
   ========================================================================== */

/** Gera "salt:hash" para guardar no .env.local */
export function criarHash(senha) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Compara em tempo constante, para não vazar informação pelo tempo de resposta. */
export function conferirSenha(senha, guardado) {
  if (!guardado || !guardado.includes(':')) return false;

  const [salt, hash] = guardado.split(':');
  let esperado, recebido;

  try {
    esperado = Buffer.from(hash, 'hex');
    recebido = scryptSync(senha, salt, 64);
  } catch {
    return false;
  }

  if (esperado.length !== recebido.length) return false;
  return timingSafeEqual(esperado, recebido);
}


/* ==========================================================================
   SESSÃO
   Token = base64url(payload) + "." + assinatura HMAC
   ========================================================================== */

function segredo() {
  const s = process.env.SESSAO_SEGREDO;
  if (!s || s.length < 24) {
    throw new Error('SESSAO_SEGREDO ausente ou curto demais no .env.local');
  }
  return s;
}

function assinar(dados) {
  return createHmac('sha256', segredo()).update(dados).digest('base64url');
}

export function criarToken() {
  const payload = Buffer
    .from(JSON.stringify({ adm: true, exp: Date.now() + DURACAO * 1000 }))
    .toString('base64url');

  return `${payload}.${assinar(payload)}`;
}

export function conferirToken(token) {
  if (!token || !token.includes('.')) return false;

  const [payload, assinatura] = token.split('.');
  const esperada = assinar(payload);

  // comparação em tempo constante
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  try {
    const { adm, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return adm === true && typeof exp === 'number' && Date.now() < exp;
  } catch {
    return false;
  }
}


/* ==========================================================================
   COOKIE
   ========================================================================== */

export async function abrirSessao() {
  const jar = await cookies();
  jar.set(COOKIE, criarToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACAO,
  });
}

export async function fecharSessao() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** true se a requisição atual tem sessão válida. */
export async function autenticado() {
  const jar = await cookies();
  return conferirToken(jar.get(COOKIE)?.value);
}

/** Resposta 401 padrão para rotas protegidas. */
export function naoAutorizado() {
  return Response.json({ erro: 'Não autorizado' }, { status: 401 });
}

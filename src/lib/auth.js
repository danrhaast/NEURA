/* ==========================================================================
   AUTH.JS — sessão do painel

   A senha é conferida no servidor e nunca volta para o navegador. O login
   devolve um cookie httpOnly assinado com HMAC-SHA256, inacessível ao
   JavaScript da página.

   O token carrega o id da conta, não um "sou admin" genérico. Quem valida
   ainda relê o usuário no banco a cada requisição: assim excluir uma conta
   ou rebaixar um papel vale na hora, sem esperar o token vencer.

   Contas são criadas pelo painel do dono ou por `npm run usuario` — não há
   cadastro público.
   ========================================================================== */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

import { buscarUsuarioPorId } from '@/lib/db';
import { podeVer, painelDaRota } from '@/lib/papeis';

const COOKIE  = 'neura_sessao';
const DURACAO = 60 * 60 * 8; // 8 horas


/* ==========================================================================
   TOKEN
   base64url(payload) + "." + assinatura HMAC
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

export function criarToken(usuario) {
  const payload = Buffer
    .from(JSON.stringify({ uid: usuario.id, exp: Date.now() + DURACAO * 1000 }))
    .toString('base64url');

  return `${payload}.${assinar(payload)}`;
}

/** Devolve o id da conta se o token for válido e estiver no prazo, senão null. */
export function lerToken(token) {
  if (!token || !token.includes('.')) return null;

  const [payload, assinatura] = token.split('.');

  let esperada;
  try {
    esperada = assinar(payload);
  } catch {
    return null; // SESSAO_SEGREDO não configurado
  }

  // comparação em tempo constante
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof uid !== 'number' || typeof exp !== 'number' || Date.now() >= exp) return null;
    return uid;
  } catch {
    return null;
  }
}


/* ==========================================================================
   COOKIE
   ========================================================================== */

export async function abrirSessao(usuario) {
  const jar = await cookies();
  jar.set(COOKIE, criarToken(usuario), {
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


/* ==========================================================================
   LEITURA DA SESSÃO
   ========================================================================== */

/**
 * A conta da requisição atual, ou null. Já sem o hash da senha — o que sai
 * daqui pode ir para o navegador.
 */
export async function sessao() {
  const jar = await cookies();
  const uid = lerToken(jar.get(COOKIE)?.value);
  if (uid === null) return null;

  // O token é válido, mas a conta pode ter sido excluída ou ter mudado de
  // papel desde que ele foi emitido. O banco é a fonte da verdade.
  return await buscarUsuarioPorId(uid);
}

/** true se a requisição atual tem sessão válida. */
export async function autenticado() {
  return (await sessao()) !== null;
}


/* ==========================================================================
   GUARDAS PARA AS ROTAS DE API
   ========================================================================== */

export function naoAutorizado() {
  return Response.json({ erro: 'Não autorizado' }, { status: 401 });
}

export function proibido() {
  return Response.json({ erro: 'Sua conta não tem acesso a esta área.' }, { status: 403 });
}

/**
 * Uso: `const { usuario, erro } = await exigirSessao(); if (erro) return erro;`
 */
export async function exigirSessao() {
  const usuario = await sessao();
  return usuario ? { usuario, erro: null } : { usuario: null, erro: naoAutorizado() };
}

/** Igual, mas também cobra que a conta enxergue o painel de `id`. */
export async function exigirPainel(id) {
  const { usuario, erro } = await exigirSessao();
  if (erro) return { usuario: null, erro };

  const painel = painelDaRota(`/admin/${id}`);
  if (painel && !podeVer(painel, usuario.papel)) {
    return { usuario: null, erro: proibido() };
  }

  return { usuario, erro: null };
}

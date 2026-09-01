/* ==========================================================================
   SENHA.JS — hash e conferência de senha

   Separado do auth.js de propósito: aqui não há import de `next/headers`,
   então os scripts de linha de comando (scripts/usuario.mjs) conseguem
   reaproveitar exatamente a mesma derivação usada pelo login.
   ========================================================================== */

import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt);

const TAMANHO = 64;

/* scrypt é caro de propósito — ~28ms por chamada nesta configuração. Na versão
   síncrona esse tempo era o event loop inteiro parado: como o rate limit do
   login é por IP e o IP vem de um header que o cliente controla, dava para
   enfileirar tentativas e travar junto o site público, que roda no mesmo
   processo. A versão assíncrona joga o trabalho no threadpool. */

/** Gera "salt:hash" para guardar no banco. */
export async function criarHash(senha) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derivar(senha, salt, TAMANHO);
  return `${salt}:${hash.toString('hex')}`;
}

/** Compara em tempo constante, para não vazar informação pelo tempo de resposta. */
export async function conferirSenha(senha, guardado) {
  if (typeof senha !== 'string' || !guardado || !guardado.includes(':')) return false;

  const [salt, hash] = guardado.split(':');
  let esperado, recebido;

  try {
    esperado = Buffer.from(hash, 'hex');
    recebido = await derivar(senha, salt, TAMANHO);
  } catch {
    return false;
  }

  if (esperado.length !== recebido.length) return false;
  return timingSafeEqual(esperado, recebido);
}

/** Regras mínimas de senha, aplicadas no servidor. */
export function senhaFraca(senha) {
  if (typeof senha !== 'string' || senha.length < 10) {
    return 'A senha precisa ter ao menos 10 caracteres.';
  }
  if (senha.length > 200) {
    return 'A senha é longa demais.';
  }
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    return 'A senha precisa misturar letras e números.';
  }
  return null;
}

/** Sugestão de senha para o dono entregar a um editor novo. */
export function sugerirSenha() {
  return randomBytes(9).toString('base64url');
}

/* ==========================================================================
   TURSO.JS — de onde saem a URL e o token do banco

   A integração do Turso no Vercel cria as variáveis prefixadas com o nome do
   recurso (ERICBANANA_TURSO_DATABASE_URL, por exemplo), e esse prefixo não é
   escolhido por nós. Procurar só pelos nomes exatos deixaria o app sem banco
   num ambiente configurado corretamente — e o pior é que ele não quebraria:
   cairia no arquivo local, e no Vercel isso é disco efêmero. O painel diria
   "Publicado no site" e o conteúdo sumiria no cold start seguinte.

   Então: nome exato primeiro; não havendo, qualquer sufixo que case.

   Módulo separado porque o scripts/migrar.mjs precisa da mesma resolução sem
   importar o db.js — que abriria a conexão com a origem, não com o destino.
   ========================================================================== */

const URL_ = 'TURSO_DATABASE_URL';
const TOKEN_ = 'TURSO_AUTH_TOKEN';

/**
 * Devolve { url, token, prefixo }. `url` vem null quando não há nada
 * configurado — quem chama decide se isso é aceitável.
 *
 * O par é sempre lido do mesmo prefixo: com dois bancos conectados no mesmo
 * projeto, casar a URL de um com o token do outro daria um erro de
 * autenticação difícil de entender.
 */
export function credenciaisTurso(ambiente = process.env) {
  if (ambiente[URL_]) {
    return { url: ambiente[URL_], token: ambiente[TOKEN_], prefixo: '' };
  }

  const chave = Object.keys(ambiente)
    .filter((k) => k.endsWith(`_${URL_}`) && ambiente[k])
    .sort()[0];

  if (!chave) return { url: null, token: null, prefixo: null };

  const prefixo = chave.slice(0, chave.length - URL_.length);
  return { url: ambiente[chave], token: ambiente[`${prefixo}${TOKEN_}`], prefixo };
}

/** true quando rodando no Vercel, onde o disco é efêmero. */
export function noVercel(ambiente = process.env) {
  return Boolean(ambiente.VERCEL);
}

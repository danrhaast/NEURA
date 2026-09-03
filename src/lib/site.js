/* ==========================================================================
   SITE.JS — o endereço público do site

   Usado pelo OpenGraph, pelo robots.txt e pelo sitemap.xml, que exigem URL
   absoluta. Antes cada um desses arquivos tinha a sua própria linha caindo em
   `http://localhost:3000` quando a variável faltava — e a falha era silenciosa:
   o build passava, e só depois se descobria que o link compartilhado no
   Instagram não gerava prévia e que o sitemap entregue ao Google apontava para
   a máquina de quem publicou.

   A ordem abaixo resolve isso no Vercel sem configuração nenhuma, e continua
   deixando o domínio próprio no comando quando ele existir.
   ========================================================================== */

function escolher() {
  // 1. Domínio definido à mão. Ganha de tudo — é o domínio da banda.
  const proprio = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (proprio) return proprio;

  // 2. No Vercel, o domínio estável de produção. Não muda a cada deploy,
  //    diferente de VERCEL_URL, que aponta para o deploy específico e
  //    colocaria uma URL descartável dentro do sitemap.
  const producao = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (producao) return `https://${producao}`;

  // 3. Prévia de branch ou deploy avulso.
  const deploy = process.env.VERCEL_URL;
  if (deploy) return `https://${deploy}`;

  return 'http://localhost:3000';
}

/** Endereço público, sempre sem barra no fim. */
export const SITE = escolher().replace(/\/+$/, '');

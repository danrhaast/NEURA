/* ==========================================================================
   Gera o segredo de sessão do painel.

   As contas do painel NÃO ficam aqui — ficam no banco, e quem as administra é
   `npm run usuario`. Este script cuida só do que mora no .env.local.

   Uso:
     npm run senha

   Copie as linhas geradas para o arquivo .env.local
   ========================================================================== */

import { randomBytes } from 'node:crypto';

const segredo = randomBytes(32).toString('base64url');

console.log('\n  Cole no .env.local:\n');
console.log(`SESSAO_SEGREDO=${segredo}`);
console.log('NEXT_PUBLIC_SITE_URL=https://seudominio.com\n');
console.log('  Depois crie a conta do painel:\n');
console.log('    npm run usuario -- criar admin --dono\n');
console.log('  Trocar o SESSAO_SEGREDO desloga todo mundo — as contas seguem valendo.\n');

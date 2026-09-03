/* ==========================================================================
   Gera os valores que moram no ambiente (.env.local ou painel do Vercel).

   As contas do painel ficam no banco, e quem as administra é
   `npm run usuario`. A exceção é o ADMIN_SENHA_HASH: ele existe só para
   destravar a PRIMEIRA conta num banco ainda vazio, sem precisar de acesso
   por linha de comando ao banco de produção.

   Uso:
     npm run senha                    só o segredo de sessão
     npm run senha -- MinhaSenha123   e também o hash da primeira conta
   ========================================================================== */

import { randomBytes } from 'node:crypto';

import { criarHash, senhaFraca } from '../src/lib/senha.js';

const senha = process.argv[2];

console.log('\n  Cole no .env.local (ou nas variáveis do Vercel):\n');
console.log(`SESSAO_SEGREDO=${randomBytes(32).toString('base64url')}`);

if (senha) {
  const fraca = senhaFraca(senha);
  if (fraca) {
    console.error(`\n  ${fraca}\n`);
    process.exit(1);
  }

  console.log(`ADMIN_SENHA_HASH=${await criarHash(senha)}`);
  console.log(`\n  A conta "admin" nasce com a senha: ${senha}`);
  console.log('  Ela é criada na primeira vez que o site abrir, se o banco ainda');
  console.log('  não tiver conta nenhuma. Depois disso a variável é ignorada e');
  console.log('  pode ser removida — troque a senha pelo painel.\n');
} else {
  console.log('\n  Depois crie a conta do painel:\n');
  console.log('    npm run usuario -- criar admin --dono');
  console.log('\n  Ou, para o banco de produção se criar sozinho, gere também o');
  console.log('  hash da primeira conta:\n');
  console.log('    npm run senha -- SuaSenhaAqui\n');
}

console.log('  Trocar o SESSAO_SEGREDO desloga todo mundo — as contas seguem valendo.\n');

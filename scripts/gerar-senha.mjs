/* ==========================================================================
   Gera o hash da senha do painel e o segredo de sessão.

   Uso:
     npm run senha -- minhaSenhaNova
     npm run senha                    (gera uma senha aleatória)

   Copie as linhas geradas para o arquivo .env.local
   ========================================================================== */

import { scryptSync, randomBytes } from 'node:crypto';

const senha = process.argv[2] || randomBytes(9).toString('base64url');

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(senha, salt, 64).toString('hex');
const segredo = randomBytes(32).toString('base64url');

console.log('\n  Senha do painel:  ' + senha);
console.log('  (guarde — ela não é recuperável a partir do hash)\n');
console.log('  Cole no .env.local:\n');
console.log(`ADMIN_SENHA_HASH=${salt}:${hash}`);
console.log(`SESSAO_SEGREDO=${segredo}\n`);

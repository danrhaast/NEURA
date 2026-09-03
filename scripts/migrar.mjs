/* ==========================================================================
   Copia o banco local para o Turso.

   Rode uma vez, na hora de subir para o Vercel: sem isto o banco de produção
   nasce só com o conteúdo inicial, e a conta do painel — que só existe no
   arquivo local — fica para trás.

   Uso:
     npm run migrar                      # data/neura.db  ->  TURSO_DATABASE_URL
     npm run migrar -- --de file:outro.db
     npm run migrar -- --forcar          # sobrescreve destino já populado

   O destino vem de TURSO_DATABASE_URL e TURSO_AUTH_TOKEN.
   ========================================================================== */

import { createClient } from '@libsql/client';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));

function opcao(nome, padrao) {
  const i = argv.indexOf(nome);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : padrao;
}

function sair(msg, codigo = 1) {
  console.error(`\n  ${msg}\n`);
  process.exit(codigo);
}

const ORIGEM  = opcao('--de', 'file:data/neura.db');
const DESTINO = process.env.TURSO_DATABASE_URL;
const TOKEN   = process.env.TURSO_AUTH_TOKEN;

if (!DESTINO) {
  sair('Defina TURSO_DATABASE_URL no .env.local (o endereço libsql:// do destino).');
}
if (DESTINO === ORIGEM) {
  sair('Origem e destino são o mesmo banco.');
}
if (DESTINO.startsWith('file:') && !flags.has('--forcar')) {
  sair(`O destino "${DESTINO}" é um arquivo local, não o Turso. Confira o TURSO_DATABASE_URL.`);
}

const de   = createClient({ url: ORIGEM });
const para = createClient(TOKEN ? { url: DESTINO, authToken: TOKEN } : { url: DESTINO });

/* Mesmo esquema do src/lib/db.js. Duplicado de propósito: este script roda
   antes de a aplicação existir no destino, e importar o db.js aqui abriria a
   conexão contra a origem, não contra o destino. */
const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS poemas (
     id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT NOT NULL DEFAULT '',
     texto TEXT NOT NULL DEFAULT '', ordem INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS videos (
     id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT NOT NULL DEFAULT '',
     legenda TEXT NOT NULL DEFAULT '', youtube TEXT NOT NULL DEFAULT '',
     ordem INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS usuarios (
     id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
     nome TEXT NOT NULL DEFAULT '', senha_hash TEXT NOT NULL,
     papel TEXT NOT NULL DEFAULT 'editor', criado_em INTEGER NOT NULL,
     ultimo_acesso INTEGER)`,
  `CREATE TABLE IF NOT EXISTS acessos (
     id INTEGER PRIMARY KEY AUTOINCREMENT, em INTEGER NOT NULL,
     caminho TEXT NOT NULL DEFAULT '/', referencia TEXT NOT NULL DEFAULT '',
     visitante TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS tentativas (
     chave TEXT PRIMARY KEY, n INTEGER NOT NULL, desde INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_acessos_em ON acessos (em)`,
  `CREATE INDEX IF NOT EXISTS idx_tentativas_desde ON tentativas (desde)`,
];

/* `acessos` fica de fora: é histórico de métrica, costuma ser a maior tabela e
   não vale a pena arrastar para dentro do plano gratuito do Turso. O gráfico
   recomeça do zero em produção, que é o comportamento certo — as visitas do
   seu ambiente local não são visitas do site. */
const TABELAS = [
  { nome: 'poemas',   colunas: ['titulo', 'texto', 'ordem'] },
  { nome: 'videos',   colunas: ['titulo', 'legenda', 'youtube', 'ordem'] },
  { nome: 'config',   colunas: ['chave', 'valor'] },
  { nome: 'usuarios', colunas: ['usuario', 'nome', 'senha_hash', 'papel', 'criado_em', 'ultimo_acesso'] },
];

console.log(`\n  De:    ${ORIGEM}`);
console.log(`  Para:  ${DESTINO}\n`);

await para.batch(ESQUEMA, 'write');

// Destino já populado é quase sempre engano — vale conferir antes de apagar.
if (!flags.has('--forcar')) {
  const { rows } = await para.execute('SELECT COUNT(*) AS n FROM usuarios');
  if (Number(rows[0].n) > 0) {
    sair('O destino já tem contas cadastradas. Use --forcar para sobrescrever.');
  }
}

const comandos = [];
let resumo = [];

for (const { nome, colunas } of TABELAS) {
  let linhas;
  try {
    ({ rows: linhas } = await de.execute(`SELECT ${colunas.join(', ')} FROM ${nome}`));
  } catch {
    console.log(`  ${nome}: tabela ausente na origem, pulando`);
    continue;
  }

  comandos.push(`DELETE FROM ${nome}`);

  for (const linha of linhas) {
    comandos.push({
      sql: `INSERT INTO ${nome} (${colunas.join(', ')}) VALUES (${colunas.map(() => '?').join(', ')})`,
      args: colunas.map((c) => linha[c] ?? null),
    });
  }

  resumo.push(`${nome}: ${linhas.length}`);
}

/* A marca de semeadura vai junto com a config, então o destino já nasce
   sabendo que não precisa semear — o conteúdo copiado não é sobrescrito
   pelos poemas iniciais na primeira requisição. */
comandos.push({
  sql: `INSERT INTO config (chave, valor) VALUES ('esquema_semeado', ?)
        ON CONFLICT(chave) DO NOTHING`,
  args: [String(Date.now())],
});

await para.batch(comandos, 'write');

console.log(`  Copiado — ${resumo.join(' · ')}`);
console.log('\n  Confira as contas no destino com:');
console.log('    npm run usuario\n');

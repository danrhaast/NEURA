/* ==========================================================================
   DB.JS — banco SQLite da Neura

   Usa o módulo nativo `node:sqlite` do Node 24 — sem dependência externa,
   sem compilação. O arquivo do banco fica em data/neura.db.

   Na primeira execução as tabelas são criadas e populadas com o conteúdo
   inicial do site.
   ========================================================================== */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const DIR  = path.join(process.cwd(), 'data');
const FILE = path.join(DIR, 'neura.db');

// Next recarrega módulos em desenvolvimento; guardamos a conexão no global
// para não abrir um banco novo a cada alteração de arquivo.
// A abertura fica no fim do arquivo: `semear` usa constantes declaradas
// abaixo e `const` não sofre hoisting.
let db = globalThis.__neuraDb;

function criarTabelas(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS poemas (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT    NOT NULL DEFAULT '',
      texto  TEXT    NOT NULL DEFAULT '',
      ordem  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS videos (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo  TEXT    NOT NULL DEFAULT '',
      legenda TEXT    NOT NULL DEFAULT '',
      youtube TEXT    NOT NULL DEFAULT '',
      ordem   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);
}

/* --- conteúdo inicial ----------------------------------------------------- */

const POEMAS_INICIAIS = [
  ['Ruído Branco', 'Eles venderam meu silêncio\nem parcelas de doze vezes.\nAgora pago juros\npara escutar a mim mesmo.'],
  ['Implante',     'Trocaram meus olhos\npor janelas com propaganda.\nA vista é melhor —\nsó não é minha.'],
  ['Neon',         'A cidade brilha tanto\nque ninguém percebe\nque já é noite\nfaz muitos anos.'],
  ['Mercadoria',   'Chorei uma vez\ne cobraram taxa de uso.\nDesde então\naprendi a sorrir de graça.'],
  ['Escolhas',     'Não existem heróis perfeitos.\nNão existem vilões absolutos.\nExistem escolhas —\ne o preço delas.'],
];

const VIDEOS_INICIAIS = [
  ['Ruído Branco', 'Clipe oficial',    ''],
  ['Implante',     'Ao vivo · Ensaio', ''],
  ['Bastidores',   'Estúdio',          ''],
];

/* BEGIN IMMEDIATE pega a trava de escrita ANTES de contar as linhas. Durante o
   `next build` vários processos worker importam este módulo ao mesmo tempo; sem
   a trava os dois leem "0 poemas" e semeiam em paralelo — um ganha, o outro
   estoura SQLITE_BUSY e derruba o build. Com ela o segundo espera, encontra as
   tabelas já populadas e não faz nada. */
function semear(d) {
  d.exec('BEGIN IMMEDIATE');
  try {
    const nPoemas = d.prepare('SELECT COUNT(*) AS n FROM poemas').get().n;
    if (nPoemas === 0) {
      const ins = d.prepare('INSERT INTO poemas (titulo, texto, ordem) VALUES (?, ?, ?)');
      POEMAS_INICIAIS.forEach(([t, x], i) => ins.run(t, x, i));
    }

    const nVideos = d.prepare('SELECT COUNT(*) AS n FROM videos').get().n;
    if (nVideos === 0) {
      const ins = d.prepare('INSERT INTO videos (titulo, legenda, youtube, ordem) VALUES (?, ?, ?, ?)');
      VIDEOS_INICIAIS.forEach(([t, l, y], i) => ins.run(t, l, y, i));
    }

    if (!d.prepare('SELECT 1 FROM config WHERE chave = ?').get('progresso_shows')) {
      d.prepare('INSERT INTO config (chave, valor) VALUES (?, ?)').run('progresso_shows', '0');
    }

    d.exec('COMMIT');
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}


/* --- abertura do banco ----------------------------------------------------
   Só aqui, depois de tudo declarado.
   -------------------------------------------------------------------------- */

if (!db) {
  mkdirSync(DIR, { recursive: true });
  // timeout: espera a trava liberar em vez de falhar na hora. O padrão do
  // node:sqlite é 0 — o concorrente recebe "database is locked" já na primeira
  // tentativa, o que quebrava o `next build` num diretório limpo.
  db = new DatabaseSync(FILE, { timeout: 5000 });

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  criarTabelas(db);
  semear(db);
  globalThis.__neuraDb = db;
}


/* ==========================================================================
   CONSULTAS
   ========================================================================== */

/* node:sqlite devolve linhas com protótipo nulo. O React se recusa a passar
   esses objetos de um Server Component para um Client Component, então
   remontamos cada linha como objeto simples aqui na origem. */

export function listarPoemas() {
  return db
    .prepare('SELECT id, titulo, texto FROM poemas ORDER BY ordem, id')
    .all()
    .map((r) => ({ id: r.id, titulo: r.titulo, texto: r.texto }));
}

export function listarVideos() {
  return db
    .prepare('SELECT id, titulo, legenda, youtube FROM videos ORDER BY ordem, id')
    .all()
    .map((r) => ({ id: r.id, titulo: r.titulo, legenda: r.legenda, youtube: r.youtube }));
}

export function lerConfig(chave, padrao = '') {
  const linha = db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave);
  return linha ? linha.valor : padrao;
}

export function gravarConfig(chave, valor) {
  db.prepare(`
    INSERT INTO config (chave, valor) VALUES (?, ?)
    ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor
  `).run(chave, String(valor));
}

/** Todo o conteúdo público numa chamada só. */
export function lerConteudo() {
  return {
    poemas: listarPoemas(),
    videos: listarVideos(),
    progressoShows: Number(lerConfig('progresso_shows', '0')) || 0,
  };
}


/* ==========================================================================
   ESCRITA
   Cada lista é substituída por inteiro: é o que o painel envia e evita
   ficar sincronizando criações, edições e exclusões uma a uma.
   ========================================================================== */

function limpar(v, max) {
  return String(v ?? '').trim().slice(0, max);
}

/* Estas duas NÃO abrem transação — quem abre é `salvarConteudo`, que envolve
   as duas listas e o progresso numa transação só. Antes cada uma tinha a sua:
   se a gravação dos vídeos falhasse, os poemas já estavam publicados e o site
   ficava com metade da edição no ar. */

function gravarPoemas(lista) {
  const gravar = db.prepare('INSERT INTO poemas (titulo, texto, ordem) VALUES (?, ?, ?)');
  db.exec('DELETE FROM poemas');
  lista.forEach((p, i) => gravar.run(limpar(p.titulo, 80), limpar(p.texto, 2000), i));
}

function gravarVideos(lista) {
  const gravar = db.prepare('INSERT INTO videos (titulo, legenda, youtube, ordem) VALUES (?, ?, ?, ?)');
  db.exec('DELETE FROM videos');
  lista.forEach((v, i) =>
    gravar.run(limpar(v.titulo, 80), limpar(v.legenda, 60), limpar(v.youtube, 300), i));
}

/** Publica a edição inteira de uma vez. Ou entra tudo, ou não entra nada. */
export function salvarConteudo({ poemas, videos, progressoShows }) {
  db.exec('BEGIN IMMEDIATE');
  try {
    gravarPoemas(poemas);
    gravarVideos(videos);

    if (progressoShows !== undefined) {
      const n = Math.max(0, Math.min(100, Math.round(Number(progressoShows) || 0)));
      gravarConfig('progresso_shows', n);
    }

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return lerConteudo();
}

export default db;

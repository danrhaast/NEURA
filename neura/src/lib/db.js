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

function semear(d) {
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
}


/* --- abertura do banco ----------------------------------------------------
   Só aqui, depois de tudo declarado.
   -------------------------------------------------------------------------- */

if (!db) {
  mkdirSync(DIR, { recursive: true });
  db = new DatabaseSync(FILE);
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

export function salvarPoemas(lista) {
  const gravar = db.prepare('INSERT INTO poemas (titulo, texto, ordem) VALUES (?, ?, ?)');

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM poemas');
    lista.forEach((p, i) => gravar.run(limpar(p.titulo, 80), limpar(p.texto, 2000), i));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return listarPoemas();
}

export function salvarVideos(lista) {
  const gravar = db.prepare('INSERT INTO videos (titulo, legenda, youtube, ordem) VALUES (?, ?, ?, ?)');

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM videos');
    lista.forEach((v, i) =>
      gravar.run(limpar(v.titulo, 80), limpar(v.legenda, 60), limpar(v.youtube, 300), i));
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return listarVideos();
}

export default db;

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

    /* Contas do painel. Não há cadastro público: só o dono cria usuários.
       O papel decide o que a conta enxerga — ver src/lib/papeis.js. */
    CREATE TABLE IF NOT EXISTS usuarios (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      nome          TEXT    NOT NULL DEFAULT '',
      senha_hash    TEXT    NOT NULL,
      papel         TEXT    NOT NULL DEFAULT 'editor',
      criado_em     INTEGER NOT NULL,
      ultimo_acesso INTEGER
    );

    /* Registro de visitas da página pública. Não guarda IP: a coluna
       visitante é um hash que troca todo dia, o que permite contar
       visitantes únicos sem manter um identificador durável de ninguém. */
    CREATE TABLE IF NOT EXISTS acessos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      em         INTEGER NOT NULL,
      caminho    TEXT    NOT NULL DEFAULT '/',
      referencia TEXT    NOT NULL DEFAULT '',
      visitante  TEXT    NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_acessos_em ON acessos (em);
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

/* Texto da seção "Sobre Nós". Ficava fixo no Sobre.jsx; agora é editável. */
const SOBRE_INICIAL = {
  sobre_p1: 'A Neura é uma banda que transforma o metal em uma experiência cinematográfica. Unindo influências que vão do heavy metal clássico ao metal contemporâneo, criamos uma identidade própria onde peso, melodia e atmosfera caminham juntos.',
  sobre_p2: 'Inspirada pelo universo cyberpunk, nossa música retrata os conflitos do mundo moderno a perda da humanidade e as batalhas internas que cada pessoa enfrenta. Não contamos histórias sobre um futuro distante, falamos da realidade, apenas através de uma nova lente.',
  sobre_foto: '',
  sobre_foto_alt: 'A banda Neura',
};

const CONFIG_INICIAL = { progresso_shows: '0', ...SOBRE_INICIAL };

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

    const existe   = d.prepare('SELECT 1 FROM config WHERE chave = ?');
    const inserir  = d.prepare('INSERT INTO config (chave, valor) VALUES (?, ?)');
    for (const [chave, valor] of Object.entries(CONFIG_INICIAL)) {
      if (!existe.get(chave)) inserir.run(chave, valor);
    }

    /* Primeira conta. Enquanto não houver nenhum usuário, aproveitamos o
       ADMIN_SENHA_HASH que já estava no .env.local: quem usava o painel antes
       continua entrando, agora com o login "admin". Sem essa variável nenhuma
       conta é criada e o login orienta a rodar `npm run usuario`. */
    const nUsuarios  = d.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
    const hashLegado = process.env.ADMIN_SENHA_HASH;

    if (nUsuarios === 0 && hashLegado && hashLegado.includes(':')) {
      d.prepare(`
        INSERT INTO usuarios (usuario, nome, senha_hash, papel, criado_em)
        VALUES (?, ?, ?, 'dono', ?)
      `).run('admin', 'Administrador', hashLegado, Date.now());
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
   CONSULTAS — CONTEÚDO
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

export function lerSobre() {
  return {
    p1:      lerConfig('sobre_p1', SOBRE_INICIAL.sobre_p1),
    p2:      lerConfig('sobre_p2', SOBRE_INICIAL.sobre_p2),
    foto:    lerConfig('sobre_foto', ''),
    fotoAlt: lerConfig('sobre_foto_alt', SOBRE_INICIAL.sobre_foto_alt),
  };
}

/** Todo o conteúdo público numa chamada só. */
export function lerConteudo() {
  return {
    poemas: listarPoemas(),
    videos: listarVideos(),
    progressoShows: Number(lerConfig('progresso_shows', '0')) || 0,
    sobre: lerSobre(),
  };
}


/* ==========================================================================
   ESCRITA — CONTEÚDO
   Cada lista é substituída por inteiro: é o que o painel envia e evita
   ficar sincronizando criações, edições e exclusões uma a uma.
   ========================================================================== */

function limpar(v, max) {
  return String(v ?? '').trim().slice(0, max);
}

/* Estas NÃO abrem transação — quem abre é `salvarConteudo`, que envolve todas
   as seções numa transação só. Antes cada uma tinha a sua: se a gravação dos
   vídeos falhasse, os poemas já estavam publicados e o site ficava com metade
   da edição no ar. */

function gravarPoemas(lista) {
  const gravar = db.prepare('INSERT INTO poemas (titulo, texto, ordem) VALUES (?, ?, ?)');
  db.exec('DELETE FROM poemas');
  lista.forEach((p, i) => gravar.run(limpar(p?.titulo, 80), limpar(p?.texto, 2000), i));
}

function gravarVideos(lista) {
  const gravar = db.prepare('INSERT INTO videos (titulo, legenda, youtube, ordem) VALUES (?, ?, ?, ?)');
  db.exec('DELETE FROM videos');
  lista.forEach((v, i) =>
    gravar.run(limpar(v?.titulo, 80), limpar(v?.legenda, 60), limpar(v?.youtube, 300), i));
}

function gravarSobre(sobre) {
  gravarConfig('sobre_p1',       limpar(sobre?.p1, 1200));
  gravarConfig('sobre_p2',       limpar(sobre?.p2, 1200));
  gravarConfig('sobre_foto',     limpar(sobre?.foto, 400));
  gravarConfig('sobre_foto_alt', limpar(sobre?.fotoAlt, 160));
}

/* Cada painel edita só a sua seção, então o PUT aceita payload parcial: o que
   não vier fica como está. Assim um painel aberto em outra aba não sobrescreve
   com dados velhos aquilo que ele nem mostra. */

/** Publica a edição de uma ou mais seções. Ou entra tudo, ou não entra nada. */
export function salvarConteudo({ poemas, videos, progressoShows, sobre }) {
  db.exec('BEGIN IMMEDIATE');
  try {
    if (poemas !== undefined) gravarPoemas(poemas);
    if (videos !== undefined) gravarVideos(videos);

    if (progressoShows !== undefined) {
      const n = Math.max(0, Math.min(100, Math.round(Number(progressoShows) || 0)));
      gravarConfig('progresso_shows', n);
    }

    if (sobre !== undefined) gravarSobre(sobre);

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return lerConteudo();
}


/* ==========================================================================
   USUÁRIOS
   Sem cadastro público: contas nascem pelo painel do dono ou pelo
   `npm run usuario`. O hash da senha nunca sai destas funções.
   ========================================================================== */

const PAPEIS = ['dono', 'editor'];

/** Linha sem o hash — é o formato que pode circular até o navegador. */
function publico(r) {
  if (!r) return null;
  return {
    id: r.id,
    usuario: r.usuario,
    nome: r.nome,
    papel: r.papel,
    criadoEm: r.criado_em,
    ultimoAcesso: r.ultimo_acesso ?? null,
  };
}

export function listarUsuarios() {
  return db
    .prepare('SELECT id, usuario, nome, papel, criado_em, ultimo_acesso FROM usuarios ORDER BY id')
    .all()
    .map(publico);
}

export function contarUsuarios() {
  return db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
}

export function buscarUsuarioPorId(id) {
  return publico(
    db.prepare('SELECT id, usuario, nome, papel, criado_em, ultimo_acesso FROM usuarios WHERE id = ?').get(id)
  );
}

/** Só para o login: é a única função que devolve o hash. */
export function buscarUsuarioParaLogin(usuario) {
  const r = db
    .prepare('SELECT id, usuario, nome, senha_hash, papel FROM usuarios WHERE usuario = ?')
    .get(String(usuario ?? '').trim());

  return r ? { id: r.id, usuario: r.usuario, nome: r.nome, senhaHash: r.senha_hash, papel: r.papel } : null;
}

export function registrarAcessoUsuario(id) {
  db.prepare('UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?').run(Date.now(), id);
}

/** Lança se o login já existir — a coluna é UNIQUE COLLATE NOCASE. */
export function criarUsuario({ usuario, nome, senhaHash, papel = 'editor' }) {
  const login = limpar(usuario, 40).toLowerCase();
  const info = db
    .prepare('INSERT INTO usuarios (usuario, nome, senha_hash, papel, criado_em) VALUES (?, ?, ?, ?, ?)')
    .run(login, limpar(nome, 80), senhaHash, PAPEIS.includes(papel) ? papel : 'editor', Date.now());

  return buscarUsuarioPorId(Number(info.lastInsertRowid));
}

/** Atualiza só os campos presentes. `senhaHash` ausente mantém a senha atual. */
export function atualizarUsuario(id, { nome, papel, senhaHash }) {
  const campos = [];
  const vals = [];

  if (nome !== undefined)  { campos.push('nome = ?');       vals.push(limpar(nome, 80)); }
  if (papel !== undefined && PAPEIS.includes(papel)) { campos.push('papel = ?'); vals.push(papel); }
  if (senhaHash !== undefined) { campos.push('senha_hash = ?'); vals.push(senhaHash); }

  if (campos.length) {
    vals.push(id);
    db.prepare(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`).run(...vals);
  }

  return buscarUsuarioPorId(id);
}

export function excluirUsuario(id) {
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
}

/** Quantos donos existem — usado para não deixar o painel sem administrador. */
export function contarDonos() {
  return db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE papel = 'dono'").get().n;
}


/* ==========================================================================
   ACESSOS — métricas da página pública
   ========================================================================== */

const DIA = 24 * 60 * 60 * 1000;
const RETENCAO = 180 * DIA;

export function registrarVisita({ caminho, referencia, visitante }) {
  db.prepare('INSERT INTO acessos (em, caminho, referencia, visitante) VALUES (?, ?, ?, ?)')
    .run(Date.now(), limpar(caminho, 200) || '/', limpar(referencia, 200), limpar(visitante, 64));
}

/* O registro é permanente até alguém apagar. Sem poda, um site com tráfego
   real engorda o arquivo do banco para sempre — e o banco inteiro é o que
   precisa caber no backup. Seis meses é bem mais do que o painel mostra. */
export function podarAcessos() {
  db.prepare('DELETE FROM acessos WHERE em < ?').run(Date.now() - RETENCAO);
}

function contar(sql, ...args) {
  return db.prepare(sql).get(...args)?.n ?? 0;
}

/**
 * Resumo para o dashboard: totais, série diária dos últimos `dias` e as
 * origens mais frequentes.
 */
export function lerMetricas(dias = 14) {
  const agora = Date.now();
  const desde = agora - dias * DIA;

  // Série diária. Monta o eixo completo primeiro para os dias sem visita
  // aparecerem como zero em vez de sumirem do gráfico.
  const serie = [];
  const indice = new Map();
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(agora - i * DIA);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const ponto = { dia: chave, visitas: 0, visitantes: 0 };
    serie.push(ponto);
    indice.set(chave, ponto);
  }

  const linhas = db
    .prepare(`
      SELECT date(em / 1000, 'unixepoch', 'localtime') AS dia,
             COUNT(*)                    AS visitas,
             COUNT(DISTINCT visitante)   AS visitantes
        FROM acessos
       WHERE em >= ?
       GROUP BY dia
    `)
    .all(desde);

  for (const l of linhas) {
    const ponto = indice.get(l.dia);
    if (ponto) { ponto.visitas = l.visitas; ponto.visitantes = l.visitantes; }
  }

  const origens = db
    .prepare(`
      SELECT referencia, COUNT(*) AS n
        FROM acessos
       WHERE em >= ? AND referencia <> ''
       GROUP BY referencia
       ORDER BY n DESC
       LIMIT 8
    `)
    .all(desde)
    .map((r) => ({ origem: r.referencia, visitas: r.n }));

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);

  return {
    dias,
    total:          contar('SELECT COUNT(*) AS n FROM acessos'),
    hoje:           contar('SELECT COUNT(*) AS n FROM acessos WHERE em >= ?', inicioHoje.getTime()),
    ultimos7:       contar('SELECT COUNT(*) AS n FROM acessos WHERE em >= ?', agora - 7 * DIA),
    ultimos30:      contar('SELECT COUNT(*) AS n FROM acessos WHERE em >= ?', agora - 30 * DIA),
    visitantes7:    contar('SELECT COUNT(DISTINCT visitante) AS n FROM acessos WHERE em >= ?', agora - 7 * DIA),
    visitantesHoje: contar('SELECT COUNT(DISTINCT visitante) AS n FROM acessos WHERE em >= ?', inicioHoje.getTime()),
    serie,
    origens,
  };
}

export default db;

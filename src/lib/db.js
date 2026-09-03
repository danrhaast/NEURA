/* ==========================================================================
   DB.JS — banco da Neura, sobre libSQL

   Um caminho de código para os dois ambientes: o cliente libSQL aceita tanto
   um arquivo local (`file:data/neura.db`) quanto o Turso
   (`libsql://...`). Em desenvolvimento você continua com um arquivo em disco;
   em produção, no Vercel, o disco é efêmero e o banco tem que morar fora do
   processo — publicar pelo painel pareceria funcionar e o conteúdo sumiria no
   cold start seguinte.

   Por isso tudo aqui é assíncrono: o banco de produção está do outro lado da
   rede, não em `node:sqlite` no mesmo processo.

   Variáveis (.env.local ou painel do Vercel):
     TURSO_DATABASE_URL   file:data/neura.db  ·  libsql://xxx.turso.io
     TURSO_AUTH_TOKEN     só para libsql://
   ========================================================================== */

import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const URL_BANCO = process.env.TURSO_DATABASE_URL || 'file:data/neura.db';
const TOKEN     = process.env.TURSO_AUTH_TOKEN;

/* Fuso do público do site, em minutos, para o dashboard agrupar as visitas
   pelo dia de quem está no Brasil. O servidor do Vercel roda em UTC, então
   sem isto o "hoje" do gráfico viraria às 21h. */
export const FUSO_MINUTOS = Number(process.env.SITE_FUSO_MINUTOS ?? -180);

/* Next recarrega módulos em desenvolvimento, e no serverless cada instância
   sobe do zero; guardar no global evita reabrir a conexão a cada alteração
   de arquivo e reaproveitá-la entre requisições da mesma instância. */
function abrir() {
  if (globalThis.__neuraDb) return globalThis.__neuraDb;

  // O libSQL não cria o diretório do arquivo, e isso só existe no local: em
  // produção a URL é libsql:// e não há caminho em disco nenhum.
  if (URL_BANCO.startsWith('file:')) {
    const dir = path.dirname(URL_BANCO.slice('file:'.length));
    if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
  }

  const cliente = createClient(
    TOKEN ? { url: URL_BANCO, authToken: TOKEN } : { url: URL_BANCO }
  );

  globalThis.__neuraDb = cliente;
  return cliente;
}

const db = abrir();


/* ==========================================================================
   ESQUEMA
   ========================================================================== */

const TABELAS = [
  `CREATE TABLE IF NOT EXISTS poemas (
     id     INTEGER PRIMARY KEY AUTOINCREMENT,
     titulo TEXT    NOT NULL DEFAULT '',
     texto  TEXT    NOT NULL DEFAULT '',
     ordem  INTEGER NOT NULL DEFAULT 0
   )`,

  `CREATE TABLE IF NOT EXISTS videos (
     id      INTEGER PRIMARY KEY AUTOINCREMENT,
     titulo  TEXT    NOT NULL DEFAULT '',
     legenda TEXT    NOT NULL DEFAULT '',
     youtube TEXT    NOT NULL DEFAULT '',
     ordem   INTEGER NOT NULL DEFAULT 0
   )`,

  `CREATE TABLE IF NOT EXISTS config (
     chave TEXT PRIMARY KEY,
     valor TEXT NOT NULL
   )`,

  /* Contas do painel. Não há cadastro público: só o dono cria usuários.
     O papel decide o que a conta enxerga — ver src/lib/papeis.js. */
  `CREATE TABLE IF NOT EXISTS usuarios (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     usuario       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
     nome          TEXT    NOT NULL DEFAULT '',
     senha_hash    TEXT    NOT NULL,
     papel         TEXT    NOT NULL DEFAULT 'editor',
     criado_em     INTEGER NOT NULL,
     ultimo_acesso INTEGER
   )`,

  /* Registro de visitas da página pública. Não guarda IP: a coluna
     visitante é um hash que troca todo dia, o que permite contar
     visitantes únicos sem manter um identificador durável de ninguém. */
  `CREATE TABLE IF NOT EXISTS acessos (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     em         INTEGER NOT NULL,
     caminho    TEXT    NOT NULL DEFAULT '/',
     referencia TEXT    NOT NULL DEFAULT '',
     visitante  TEXT    NOT NULL DEFAULT ''
   )`,

  /* Freio de força bruta. Ficava num Map em memória, o que funcionava num
     servidor só. No Vercel cada invocação pode cair numa instância nova e com
     memória limpa, então o contador precisa morar no banco para valer. */
  `CREATE TABLE IF NOT EXISTS tentativas (
     chave TEXT    PRIMARY KEY,
     n     INTEGER NOT NULL,
     desde INTEGER NOT NULL
   )`,

  `CREATE INDEX IF NOT EXISTS idx_acessos_em ON acessos (em)`,
  `CREATE INDEX IF NOT EXISTS idx_tentativas_desde ON tentativas (desde)`,
];


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

const MARCA_SEMEADO = 'esquema_semeado';


/* --- preparação, uma vez por instância ------------------------------------
   A promessa é guardada: dez requisições simultâneas num cold start esperam
   a mesma preparação em vez de disparar dez migrações.
   -------------------------------------------------------------------------- */

async function preparar() {
  await db.batch(TABELAS, 'write');

  /* Reserva do direito de semear, atômica. Se duas instâncias subirem juntas
     num banco vazio, as duas veriam "0 poemas" e semeariam em paralelo — o
     site abriria com o conteúdo inicial duplicado. Aqui a segunda esbarra na
     PRIMARY KEY, entende que já foi feito e sai. */
  try {
    await db.execute({
      sql: 'INSERT INTO config (chave, valor) VALUES (?, ?)',
      args: [MARCA_SEMEADO, String(Date.now())],
    });
  } catch {
    return; // outra instância semeou (ou já estava semeado)
  }

  /* A marca resolve a corrida entre duas instâncias novas, mas não diz nada
     sobre um banco que já existia antes dela — o de desenvolvimento, por
     exemplo, criado pela versão anterior. Lá a marca está ausente e o conteúdo
     não: semear direto duplicaria os cinco poemas. Por isso a contagem também. */
  const [nPoemas, nVideos] = await db.batch([
    'SELECT COUNT(*) AS n FROM poemas',
    'SELECT COUNT(*) AS n FROM videos',
  ], 'read');

  const comandos = [];

  if (Number(nPoemas.rows[0].n) === 0) {
    POEMAS_INICIAIS.forEach(([t, x], i) => comandos.push({
      sql: 'INSERT INTO poemas (titulo, texto, ordem) VALUES (?, ?, ?)',
      args: [t, x, i],
    }));
  }

  if (Number(nVideos.rows[0].n) === 0) {
    VIDEOS_INICIAIS.forEach(([t, l, y], i) => comandos.push({
      sql: 'INSERT INTO videos (titulo, legenda, youtube, ordem) VALUES (?, ?, ?, ?)',
      args: [t, l, y, i],
    }));
  }

  for (const [chave, valor] of Object.entries({ progresso_shows: '0', ...SOBRE_INICIAL })) {
    comandos.push({
      sql: 'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO NOTHING',
      args: [chave, valor],
    });
  }

  /* Primeira conta. Enquanto não houver nenhum usuário, aproveitamos o
     ADMIN_SENHA_HASH que já estava no ambiente: quem usava o painel antes
     continua entrando, agora com o login "admin". Sem essa variável nenhuma
     conta é criada e o login orienta a rodar `npm run usuario`. */
  const hashLegado = process.env.ADMIN_SENHA_HASH;
  if (hashLegado && hashLegado.includes(':')) {
    comandos.push({
      sql: `INSERT INTO usuarios (usuario, nome, senha_hash, papel, criado_em)
            VALUES (?, ?, ?, 'dono', ?) ON CONFLICT(usuario) DO NOTHING`,
      args: ['admin', 'Administrador', hashLegado, Date.now()],
    });
  }

  await db.batch(comandos, 'write');
}

let preparacao = null;

/** Toda função pública passa por aqui antes de tocar o banco. */
function pronto() {
  preparacao ??= preparar().catch((e) => {
    preparacao = null; // deixa a próxima requisição tentar de novo
    throw e;
  });
  return preparacao;
}


/* ==========================================================================
   CONSULTAS — CONTEÚDO
   ========================================================================== */

/* As linhas do libSQL não são objetos simples, e o React se recusa a passar
   esses valores de um Server Component para um Client Component. Remontamos
   cada linha aqui na origem. */

export async function listarPoemas() {
  await pronto();
  const { rows } = await db.execute('SELECT id, titulo, texto FROM poemas ORDER BY ordem, id');
  return rows.map((r) => ({ id: Number(r.id), titulo: r.titulo, texto: r.texto }));
}

export async function listarVideos() {
  await pronto();
  const { rows } = await db.execute('SELECT id, titulo, legenda, youtube FROM videos ORDER BY ordem, id');
  return rows.map((r) => ({
    id: Number(r.id), titulo: r.titulo, legenda: r.legenda, youtube: r.youtube,
  }));
}

export async function lerConfig(chave, padrao = '') {
  await pronto();
  const { rows } = await db.execute({
    sql: 'SELECT valor FROM config WHERE chave = ?',
    args: [chave],
  });
  return rows.length ? rows[0].valor : padrao;
}

export async function gravarConfig(chave, valor) {
  await pronto();
  await db.execute({
    sql: `INSERT INTO config (chave, valor) VALUES (?, ?)
          ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
    args: [chave, String(valor)],
  });
}

/** Todo o conteúdo público. Uma ida ao banco para as quatro seções. */
export async function lerConteudo() {
  await pronto();

  const [poemas, videos, config] = await db.batch([
    'SELECT id, titulo, texto FROM poemas ORDER BY ordem, id',
    'SELECT id, titulo, legenda, youtube FROM videos ORDER BY ordem, id',
    'SELECT chave, valor FROM config',
  ], 'read');

  const c = Object.fromEntries(config.rows.map((r) => [r.chave, r.valor]));

  return {
    poemas: poemas.rows.map((r) => ({ id: Number(r.id), titulo: r.titulo, texto: r.texto })),
    videos: videos.rows.map((r) => ({
      id: Number(r.id), titulo: r.titulo, legenda: r.legenda, youtube: r.youtube,
    })),
    progressoShows: Number(c.progresso_shows ?? 0) || 0,
    sobre: {
      p1:      c.sobre_p1      ?? SOBRE_INICIAL.sobre_p1,
      p2:      c.sobre_p2      ?? SOBRE_INICIAL.sobre_p2,
      foto:    c.sobre_foto    ?? '',
      fotoAlt: c.sobre_foto_alt ?? SOBRE_INICIAL.sobre_foto_alt,
    },
  };
}

export async function lerSobre() {
  return (await lerConteudo()).sobre;
}


/* ==========================================================================
   ESCRITA — CONTEÚDO
   Cada lista é substituída por inteiro: é o que o painel envia e evita
   ficar sincronizando criações, edições e exclusões uma a uma.
   ========================================================================== */

function limpar(v, max) {
  return String(v ?? '').trim().slice(0, max);
}

/* Cada painel edita só a sua seção, então o PUT aceita payload parcial: o que
   não vier fica como está. Assim um painel aberto em outra aba não sobrescreve
   com dados velhos aquilo que ele nem mostra.

   O `batch` do libSQL roda tudo numa transação: ou a edição inteira entra, ou
   nenhuma parte dela entra. Antes o site já ficou com metade de uma edição no
   ar porque poemas e vídeos gravavam separados. */
export async function salvarConteudo({ poemas, videos, progressoShows, sobre }) {
  await pronto();

  const comandos = [];

  if (poemas !== undefined) {
    comandos.push('DELETE FROM poemas');
    poemas.forEach((p, i) => comandos.push({
      sql: 'INSERT INTO poemas (titulo, texto, ordem) VALUES (?, ?, ?)',
      args: [limpar(p?.titulo, 80), limpar(p?.texto, 2000), i],
    }));
  }

  if (videos !== undefined) {
    comandos.push('DELETE FROM videos');
    videos.forEach((v, i) => comandos.push({
      sql: 'INSERT INTO videos (titulo, legenda, youtube, ordem) VALUES (?, ?, ?, ?)',
      args: [limpar(v?.titulo, 80), limpar(v?.legenda, 60), limpar(v?.youtube, 300), i],
    }));
  }

  const config = (chave, valor) => comandos.push({
    sql: `INSERT INTO config (chave, valor) VALUES (?, ?)
          ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
    args: [chave, String(valor)],
  });

  if (progressoShows !== undefined) {
    config('progresso_shows', Math.max(0, Math.min(100, Math.round(Number(progressoShows) || 0))));
  }

  if (sobre !== undefined) {
    config('sobre_p1',       limpar(sobre?.p1, 1200));
    config('sobre_p2',       limpar(sobre?.p2, 1200));
    config('sobre_foto',     limpar(sobre?.foto, 400));
    config('sobre_foto_alt', limpar(sobre?.fotoAlt, 160));
  }

  await db.batch(comandos, 'write');
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
    id: Number(r.id),
    usuario: r.usuario,
    nome: r.nome,
    papel: r.papel,
    criadoEm: Number(r.criado_em),
    ultimoAcesso: r.ultimo_acesso == null ? null : Number(r.ultimo_acesso),
  };
}

const CAMPOS = 'id, usuario, nome, papel, criado_em, ultimo_acesso';

export async function listarUsuarios() {
  await pronto();
  const { rows } = await db.execute(`SELECT ${CAMPOS} FROM usuarios ORDER BY id`);
  return rows.map(publico);
}

export async function contarUsuarios() {
  await pronto();
  const { rows } = await db.execute('SELECT COUNT(*) AS n FROM usuarios');
  return Number(rows[0].n);
}

export async function buscarUsuarioPorId(id) {
  await pronto();
  const { rows } = await db.execute({
    sql: `SELECT ${CAMPOS} FROM usuarios WHERE id = ?`,
    args: [id],
  });
  return publico(rows[0]);
}

/** Só para o login: é a única função que devolve o hash. */
export async function buscarUsuarioParaLogin(usuario) {
  await pronto();
  const { rows } = await db.execute({
    sql: 'SELECT id, usuario, nome, senha_hash, papel FROM usuarios WHERE usuario = ?',
    args: [String(usuario ?? '').trim()],
  });

  const r = rows[0];
  return r
    ? { id: Number(r.id), usuario: r.usuario, nome: r.nome, senhaHash: r.senha_hash, papel: r.papel }
    : null;
}

export async function registrarAcessoUsuario(id) {
  await pronto();
  await db.execute({
    sql: 'UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?',
    args: [Date.now(), id],
  });
}

/** Lança se o login já existir — a coluna é UNIQUE COLLATE NOCASE. */
export async function criarUsuario({ usuario, nome, senhaHash, papel = 'editor' }) {
  await pronto();
  const r = await db.execute({
    sql: 'INSERT INTO usuarios (usuario, nome, senha_hash, papel, criado_em) VALUES (?, ?, ?, ?, ?)',
    args: [
      limpar(usuario, 40).toLowerCase(),
      limpar(nome, 80),
      senhaHash,
      PAPEIS.includes(papel) ? papel : 'editor',
      Date.now(),
    ],
  });

  return buscarUsuarioPorId(Number(r.lastInsertRowid));
}

/** Atualiza só os campos presentes. `senhaHash` ausente mantém a senha atual. */
export async function atualizarUsuario(id, { nome, papel, senhaHash }) {
  await pronto();

  const campos = [];
  const args = [];

  if (nome !== undefined)      { campos.push('nome = ?');       args.push(limpar(nome, 80)); }
  if (papel !== undefined && PAPEIS.includes(papel)) { campos.push('papel = ?'); args.push(papel); }
  if (senhaHash !== undefined) { campos.push('senha_hash = ?'); args.push(senhaHash); }

  if (campos.length) {
    args.push(id);
    await db.execute({ sql: `UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, args });
  }

  return buscarUsuarioPorId(id);
}

export async function excluirUsuario(id) {
  await pronto();
  await db.execute({ sql: 'DELETE FROM usuarios WHERE id = ?', args: [id] });
}

/** Quantos donos existem — usado para não deixar o painel sem administrador. */
export async function contarDonos() {
  await pronto();
  const { rows } = await db.execute("SELECT COUNT(*) AS n FROM usuarios WHERE papel = 'dono'");
  return Number(rows[0].n);
}


/* ==========================================================================
   FREIO DE TENTATIVAS
   ========================================================================== */

/**
 * Conta uma tentativa e diz se a chave passou do limite na janela.
 *
 * Uma ida ao banco só: o UPSERT decide entre reiniciar a janela e incrementar,
 * e o RETURNING traz o total já atualizado. Fazer isto em SELECT + UPDATE
 * abriria espaço para duas requisições simultâneas lerem o mesmo valor.
 */
export async function contarTentativa(chave, janelaMs, limite) {
  await pronto();
  const agora = Date.now();

  const { rows } = await db.execute({
    sql: `INSERT INTO tentativas (chave, n, desde) VALUES (?, 1, ?)
          ON CONFLICT(chave) DO UPDATE SET
            n     = CASE WHEN ? - tentativas.desde > ? THEN 1 ELSE tentativas.n + 1 END,
            desde = CASE WHEN ? - tentativas.desde > ? THEN ? ELSE tentativas.desde END
          RETURNING n`,
    args: [chave, agora, agora, janelaMs, agora, janelaMs, agora],
  });

  return Number(rows[0].n) > limite;
}

export async function zerarTentativa(chave) {
  await pronto();
  await db.execute({ sql: 'DELETE FROM tentativas WHERE chave = ?', args: [chave] });
}


/* ==========================================================================
   ACESSOS — métricas da página pública
   ========================================================================== */

const DIA = 24 * 60 * 60 * 1000;
const RETENCAO = 180 * DIA;

/** Meia-noite no fuso do público, em milissegundos. */
function inicioDoDiaLocal(ms = Date.now()) {
  const deslocado = ms + FUSO_MINUTOS * 60_000;
  return deslocado - (deslocado % DIA) - FUSO_MINUTOS * 60_000;
}

/** AAAA-MM-DD no fuso do público. */
export function diaLocal(ms = Date.now()) {
  return new Date(ms + FUSO_MINUTOS * 60_000).toISOString().slice(0, 10);
}

export async function registrarVisita({ caminho, referencia, visitante }) {
  await pronto();
  await db.execute({
    sql: 'INSERT INTO acessos (em, caminho, referencia, visitante) VALUES (?, ?, ?, ?)',
    args: [Date.now(), limpar(caminho, 200) || '/', limpar(referencia, 200), limpar(visitante, 64)],
  });
}

/* O registro é permanente até alguém apagar. Sem poda, um site com tráfego
   real engorda o banco para sempre — e no plano gratuito do Turso o espaço é
   contado. Seis meses é bem mais do que o painel mostra.

   A marca da última poda fica no banco, não numa variável do processo: no
   serverless a variável se perde a cada instância nova, e a poda passaria a
   rodar em quase toda requisição. */
export async function podarSeVencido() {
  await pronto();
  const agora = Date.now();

  const { rows } = await db.execute({
    sql: `INSERT INTO config (chave, valor) VALUES ('ultima_poda', ?)
          ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor
            WHERE CAST(config.valor AS INTEGER) < ?
          RETURNING valor`,
    args: [String(agora), agora - DIA],
  });

  // Sem linha devolvida, a cláusula WHERE barrou: alguém já podou hoje.
  if (!rows.length) return false;

  await db.batch([
    { sql: 'DELETE FROM acessos WHERE em < ?', args: [agora - RETENCAO] },
    { sql: 'DELETE FROM tentativas WHERE desde < ?', args: [agora - DIA] },
  ], 'write');

  return true;
}

/**
 * Resumo para o dashboard: totais, série diária dos últimos `dias` e as
 * origens mais frequentes.
 */
export async function lerMetricas(dias = 14) {
  await pronto();

  const agora = Date.now();
  const desde = agora - dias * DIA;
  const inicioHoje = inicioDoDiaLocal(agora);
  const desloc = FUSO_MINUTOS * 60; // segundos, para o date() do SQLite

  const [porDia, origens, totais] = await db.batch([
    {
      sql: `SELECT date((em / 1000) + ?, 'unixepoch') AS dia,
                   COUNT(*)                  AS visitas,
                   COUNT(DISTINCT visitante) AS visitantes
              FROM acessos
             WHERE em >= ?
             GROUP BY dia`,
      args: [desloc, desde],
    },
    {
      sql: `SELECT referencia, COUNT(*) AS n
              FROM acessos
             WHERE em >= ? AND referencia <> ''
             GROUP BY referencia
             ORDER BY n DESC
             LIMIT 8`,
      args: [desde],
    },
    {
      sql: `SELECT
              COUNT(*)                                                   AS total,
              COUNT(CASE WHEN em >= ?1 THEN 1 END)                       AS hoje,
              COUNT(DISTINCT CASE WHEN em >= ?1 THEN visitante END)       AS visitantes_hoje,
              COUNT(CASE WHEN em >= ?2 THEN 1 END)                       AS ultimos7,
              COUNT(DISTINCT CASE WHEN em >= ?2 THEN visitante END)       AS visitantes7,
              COUNT(CASE WHEN em >= ?3 THEN 1 END)                       AS ultimos30
            FROM acessos`,
      args: [inicioHoje, agora - 7 * DIA, agora - 30 * DIA],
    },
  ], 'read');

  // Monta o eixo completo primeiro, para os dias sem visita aparecerem como
  // zero em vez de sumirem do gráfico.
  const serie = [];
  const indice = new Map();
  for (let i = dias - 1; i >= 0; i--) {
    const chave = diaLocal(agora - i * DIA);
    const ponto = { dia: chave, visitas: 0, visitantes: 0 };
    serie.push(ponto);
    indice.set(chave, ponto);
  }

  for (const l of porDia.rows) {
    const ponto = indice.get(l.dia);
    if (ponto) {
      ponto.visitas = Number(l.visitas);
      ponto.visitantes = Number(l.visitantes);
    }
  }

  const t = totais.rows[0];

  return {
    dias,
    total:          Number(t.total),
    hoje:           Number(t.hoje),
    ultimos7:       Number(t.ultimos7),
    ultimos30:      Number(t.ultimos30),
    visitantes7:    Number(t.visitantes7),
    visitantesHoje: Number(t.visitantes_hoje),
    serie,
    origens: origens.rows.map((r) => ({ origem: r.referencia, visitas: Number(r.n) })),
  };
}

export default db;

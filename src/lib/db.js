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

   A integração do Turso no Vercel cria essas duas com um prefixo de recurso
   (ALGO_TURSO_DATABASE_URL); os dois formatos são aceitos — ver ./turso.js.
   ========================================================================== */

import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/* Relativo, e não pelo alias @/: os scripts de linha de comando importam este
   arquivo direto pelo node, fora do build do Next, onde o alias não existe. */
import { credenciaisTurso, noVercel } from './turso.js';

/* A integração do Vercel prefixa as variáveis com o nome do recurso; a
   resolução está em src/lib/turso.js. */
const { url: URL_TURSO, token: TOKEN, prefixo } = credenciaisTurso();

const URL_BANCO = URL_TURSO || 'file:data/neura.db';

/* Sem banco remoto no Vercel, o app cairia no arquivo local — que lá é disco
   efêmero. Isso não daria erro nenhum: o painel gravaria, diria "Publicado no
   site", e o conteúdo sumiria no cold start seguinte, junto com as contas.
   Falhar o deploy é muito melhor do que perder o conteúdo em silêncio. */
if (noVercel() && !URL_TURSO) {
  throw new Error(
    'TURSO_DATABASE_URL não encontrada. O Vercel tem disco efêmero e o banco ' +
    'precisa ficar no Turso. Conecte a integração do Turso ao projeto ou ' +
    'cadastre TURSO_DATABASE_URL e TURSO_AUTH_TOKEN nas variáveis de ambiente.'
  );
}

if (prefixo) {
  console.log(`Banco lido de ${prefixo}TURSO_DATABASE_URL (prefixo da integração).`);
}

/* Fuso do público do site, para o dashboard agrupar as visitas pelo dia de
   quem olha. O servidor do Vercel roda em UTC, então sem isto o "hoje" do
   gráfico viraria no meio da tarde.

   É o nome IANA da zona, não um deslocamento em minutos: os Estados Unidos
   têm horário de verão, e um número fixo erraria uma hora durante boa parte
   do ano — junto com a virada do dia no gráfico. O nome deixa o `Intl`
   resolver a transição sozinho. */
const FUSO_PADRAO = 'America/New_York';

function fusoValido(nome) {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: nome });
    return true;
  } catch {
    return false;
  }
}

export const FUSO = (() => {
  const escolhido = process.env.SITE_FUSO?.trim();
  if (!escolhido) return FUSO_PADRAO;

  if (!fusoValido(escolhido)) {
    console.error(`SITE_FUSO inválido ("${escolhido}"); usando ${FUSO_PADRAO}.`);
    return FUSO_PADRAO;
  }
  return escolhido;
})();

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
  let semear = true;
  try {
    await db.execute({
      sql: 'INSERT INTO config (chave, valor) VALUES (?, ?)',
      args: [MARCA_SEMEADO, String(Date.now())],
    });
  } catch {
    semear = false; // outra instância semeou (ou já estava semeado)
  }

  /* A primeira conta é conferida SEMPRE, mesmo em banco já semeado. Antes ela
     morava junto da semeadura, e o resultado era uma armadilha: num banco que
     já tinha semeado — o que acontece no primeiro acesso à home, antes de
     qualquer configuração — cadastrar ADMIN_SENHA_HASH depois não fazia nada,
     sem erro nem aviso. Quem chegasse ali ficava sem como entrar no painel. */
  await garantirPrimeiraConta();

  if (!semear) return;

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

  await db.batch(comandos, 'write');
}

/**
 * Cria a conta "admin" a partir do ADMIN_SENHA_HASH, se o banco não tiver
 * conta nenhuma.
 *
 * É a porta de entrada de um banco de produção onde não dá para rodar a linha
 * de comando. Roda a cada preparação, não só na semeadura: o banco costuma
 * nascer semeado no primeiro acesso à home, muito antes de alguém cadastrar a
 * variável, e amarrar as duas coisas tornava o atalho inútil justamente para
 * quem precisava dele.
 *
 * A condição é "nenhuma conta", nunca "não existe admin": senão, apagar a
 * conta admin de propósito a faria voltar sozinha no próximo cold start.
 */
async function garantirPrimeiraConta() {
  const hash = process.env.ADMIN_SENHA_HASH;
  if (!hash || !hash.includes(':')) return;

  const { rows } = await db.execute('SELECT COUNT(*) AS n FROM usuarios');
  if (Number(rows[0].n) > 0) return;

  await db.execute({
    sql: `INSERT INTO usuarios (usuario, nome, senha_hash, papel, criado_em)
          VALUES (?, ?, ?, 'dono', ?) ON CONFLICT(usuario) DO NOTHING`,
    args: ['admin', 'Administrador', hash, Date.now()],
  });

  console.log('Conta "admin" criada a partir de ADMIN_SENHA_HASH.');
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

/* --- datas no fuso do público --------------------------------------------
   Tudo abaixo existe porque o dia do gráfico é o dia de quem visita o site,
   não o dia UTC do servidor — e porque esse dia nem sempre tem 24 horas: nas
   duas viradas do horário de verão ele tem 23 ou 25.
   -------------------------------------------------------------------------- */

const FORMATO_DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
});

/* hourCycle h23 para a meia-noite sair como 00, e não como 24. */
const FORMATO_COMPLETO = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** AAAA-MM-DD no fuso do público. */
export function diaLocal(ms = Date.now()) {
  return FORMATO_DIA.format(new Date(ms));
}

/** Quantos minutos o fuso está deslocado do UTC naquele instante. */
function deslocamento(ms) {
  const p = Object.fromEntries(
    FORMATO_COMPLETO.formatToParts(new Date(ms)).map((x) => [x.type, x.value])
  );

  const comoSeFosseUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour), Number(p.minute), Number(p.second)
  );

  return (comoSeFosseUtc - Math.floor(ms / 1000) * 1000) / 60_000;
}

/**
 * Meia-noite de um dia AAAA-MM-DD, em milissegundos UTC.
 *
 * Duas passadas: a primeira estima o deslocamento pelo palpite em UTC, a
 * segunda o corrige usando o instante já ajustado. Sem isso, um dia que começa
 * logo depois da virada do horário de verão sairia uma hora fora.
 */
function inicioDoDia(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const palpite = Date.UTC(ano, mes - 1, dia);

  const primeira = palpite - deslocamento(palpite) * 60_000;
  return palpite - deslocamento(primeira) * 60_000;
}

/** Meia-noite de hoje no fuso do público. */
function inicioDoDiaLocal(ms = Date.now()) {
  return inicioDoDia(diaLocal(ms));
}

/**
 * Os últimos `n` dias do calendário, terminando em hoje.
 *
 * A conta é feita sobre a data, não sobre o relógio: subtrair 24h por dia
 * pularia ou repetiria uma data nas semanas em que o horário de verão vira.
 */
function ultimosDias(n, agora) {
  const [ano, mes, dia] = diaLocal(agora).split('-').map(Number);
  const base = Date.UTC(ano, mes - 1, dia);

  return Array.from({ length: n }, (_, i) =>
    new Date(base - (n - 1 - i) * DIA).toISOString().slice(0, 10));
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
  const inicioHoje = inicioDoDiaLocal(agora);

  /* O eixo é montado antes da consulta: são estes limites que definem onde
     cada dia começa. O SQLite não conhece a base de fusos IANA — o `localtime`
     dele seria o fuso do servidor, que no Vercel é UTC — então quem calcula a
     virada é o JavaScript, e o SQL só recebe os instantes prontos. */
  const eixo = ultimosDias(dias, agora);
  const limites = eixo.map(inicioDoDia);
  const desde = limites[0];

  // WHEN em < <início do dia seguinte> THEN <índice do dia>
  const faixas = limites.slice(1).map((_, i) => `WHEN em < ? THEN ${i}`).join(' ');

  const [porDia, origens, totais] = await db.batch([
    {
      sql: `SELECT CASE ${faixas} ELSE ${dias - 1} END AS d,
                   COUNT(*)                  AS visitas,
                   COUNT(DISTINCT visitante) AS visitantes
              FROM acessos
             WHERE em >= ?
             GROUP BY d`,
      args: [...limites.slice(1), desde],
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

  // Dias sem visita entram como zero em vez de sumirem do gráfico.
  const serie = eixo.map((dia) => ({ dia, visitas: 0, visitantes: 0 }));

  for (const l of porDia.rows) {
    const ponto = serie[Number(l.d)];
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

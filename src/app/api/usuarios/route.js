/* ==========================================================================
   GET  /api/usuarios   → lista as contas do painel   (só o dono)
   POST /api/usuarios   → cria uma conta               (só o dono)

   Não existe cadastro público: esta rota é a única porta de entrada de contas
   novas pela web, e ela cobra sessão de dono. A alternativa é a linha de
   comando, `npm run usuario`.
   ========================================================================== */

import { exigirSessao, proibido } from '@/lib/auth';
import { criarHash, senhaFraca } from '@/lib/senha';
import { ehPapelValido } from '@/lib/papeis';
import { listarUsuarios, criarUsuario, buscarUsuarioParaLogin } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORMATO_LOGIN = /^[a-z0-9._-]{3,40}$/;

async function exigirDono() {
  const { usuario, erro } = await exigirSessao();
  if (erro) return { usuario: null, erro };
  if (usuario.papel !== 'dono') return { usuario: null, erro: proibido() };
  return { usuario, erro: null };
}

export async function GET() {
  const { erro } = await exigirDono();
  if (erro) return erro;

  try {
    return Response.json({ usuarios: await listarUsuarios() });
  } catch (e) {
    console.error('GET /api/usuarios', e);
    return Response.json({ erro: 'Falha ao ler as contas' }, { status: 500 });
  }
}

export async function POST(req) {
  const { erro } = await exigirDono();
  if (erro) return erro;

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return Response.json({ erro: 'JSON inválido' }, { status: 400 });
  }

  const { usuario, nome, senha, papel = 'editor' } = corpo ?? {};
  const login = String(usuario ?? '').trim().toLowerCase();

  if (!FORMATO_LOGIN.test(login)) {
    return Response.json(
      { erro: 'O usuário deve ter de 3 a 40 caracteres, usando letras, números, ponto, hífen ou sublinhado.' },
      { status: 400 }
    );
  }

  if (!ehPapelValido(papel)) {
    return Response.json({ erro: 'Papel inválido.' }, { status: 400 });
  }

  const fraca = senhaFraca(senha);
  if (fraca) return Response.json({ erro: fraca }, { status: 400 });

  // Checagem amigável antes de tentar gravar; a coluna é UNIQUE de qualquer
  // forma, então o catch abaixo ainda cobre a corrida entre duas criações.
  if (await buscarUsuarioParaLogin(login)) {
    return Response.json({ erro: 'Já existe uma conta com esse usuário.' }, { status: 409 });
  }

  try {
    const senhaHash = await criarHash(senha);
    const criado = await criarUsuario({ usuario: login, nome, senhaHash, papel });
    return Response.json({ ok: true, usuario: criado }, { status: 201 });
  } catch (e) {
    if (String(e?.message).includes('UNIQUE')) {
      return Response.json({ erro: 'Já existe uma conta com esse usuário.' }, { status: 409 });
    }
    console.error('POST /api/usuarios', e);
    return Response.json({ erro: 'Falha ao criar a conta' }, { status: 500 });
  }
}

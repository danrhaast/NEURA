/* ==========================================================================
   PATCH  /api/usuarios/:id   → altera nome, papel ou senha   (só o dono)
   DELETE /api/usuarios/:id   → remove a conta                (só o dono)

   Duas travas para o painel não ficar sem administrador: ninguém exclui a
   própria conta, e o último dono não pode ser rebaixado nem removido.
   ========================================================================== */

import { exigirSessao, proibido } from '@/lib/auth';
import { criarHash, senhaFraca } from '@/lib/senha';
import { ehPapelValido } from '@/lib/papeis';
import { buscarUsuarioPorId, atualizarUsuario, excluirUsuario, contarDonos } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function contexto(params) {
  const { usuario: eu, erro } = await exigirSessao();
  if (erro) return { erro };
  if (eu.papel !== 'dono') return { erro: proibido() };

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return { erro: Response.json({ erro: 'Id inválido' }, { status: 400 }) };
  }

  const alvo = buscarUsuarioPorId(id);
  if (!alvo) {
    return { erro: Response.json({ erro: 'Conta não encontrada' }, { status: 404 }) };
  }

  return { eu, alvo, erro: null };
}

export async function PATCH(req, { params }) {
  const { eu, alvo, erro } = await contexto(params);
  if (erro) return erro;

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return Response.json({ erro: 'JSON inválido' }, { status: 400 });
  }

  const { nome, papel, senha } = corpo ?? {};
  const mudancas = {};

  if (nome !== undefined) mudancas.nome = String(nome);

  if (papel !== undefined) {
    if (!ehPapelValido(papel)) {
      return Response.json({ erro: 'Papel inválido.' }, { status: 400 });
    }
    if (alvo.papel === 'dono' && papel !== 'dono' && contarDonos() <= 1) {
      return Response.json(
        { erro: 'Esta é a única conta dona. Promova outra antes de rebaixar esta.' },
        { status: 409 }
      );
    }
    mudancas.papel = papel;
  }

  if (senha !== undefined) {
    const fraca = senhaFraca(senha);
    if (fraca) return Response.json({ erro: fraca }, { status: 400 });
    mudancas.senhaHash = await criarHash(senha);
  }

  if (!Object.keys(mudancas).length) {
    return Response.json({ erro: 'Nada para alterar' }, { status: 400 });
  }

  try {
    return Response.json({ ok: true, usuario: atualizarUsuario(alvo.id, mudancas), eu: eu.id });
  } catch (e) {
    console.error('PATCH /api/usuarios/:id', e);
    return Response.json({ erro: 'Falha ao alterar a conta' }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { eu, alvo, erro } = await contexto(params);
  if (erro) return erro;

  if (alvo.id === eu.id) {
    return Response.json(
      { erro: 'Você não pode excluir a própria conta. Peça a outro dono.' },
      { status: 409 }
    );
  }

  if (alvo.papel === 'dono' && contarDonos() <= 1) {
    return Response.json({ erro: 'Esta é a única conta dona do painel.' }, { status: 409 });
  }

  try {
    excluirUsuario(alvo.id);
    return Response.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/usuarios/:id', e);
    return Response.json({ erro: 'Falha ao excluir a conta' }, { status: 500 });
  }
}

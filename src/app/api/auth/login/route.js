/* ==========================================================================
   POST /api/auth/login   { usuario, senha }  → abre a sessão
   ========================================================================== */

import { conferirSenha } from '@/lib/senha';
import { abrirSessao } from '@/lib/auth';
import {
  buscarUsuarioParaLogin,
  registrarAcessoUsuario,
  contarUsuarios,
  contarTentativa,
  zerarTentativa,
} from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Freio contra força bruta, em duas camadas — cada uma cobre um buraco da
   outra:

   - Por IP, para não deixar uma origem só varrer senhas. O IP vem de um header
     que o cliente controla, então sozinho ele não vale muito: basta variar o
     x-forwarded-for a cada tentativa para zerar o contador.
   - Um teto global por minuto, que é justamente o que sobrevive a esse truque.
     Conferir uma senha custa ~28ms de scrypt; sem teto, uma enxurrada de
     tentativas prende o processo que também serve a página pública.

   Os contadores ficam no banco, não em memória. No Vercel cada invocação pode
   cair numa instância nova e com memória limpa — um Map local daria ao atacante
   um contador zerado a cada requisição, e o freio seria decorativo. */
const LIMITE_IP     = 8;
const JANELA_IP     = 10 * 60 * 1000;  // 10 min
const LIMITE_GLOBAL = 30;
const JANELA_GLOBAL = 60 * 1000;       // 1 min

/* Hash descartável com o mesmo formato de um real, para gastar o mesmo tempo
   quando o usuário informado não existe. Nenhuma senha bate com ele. */
const HASH_FALSO = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

export async function POST(req) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'local';

  const [excedeuGlobal, excedeuIp] = await Promise.all([
    contarTentativa('login:global', JANELA_GLOBAL, LIMITE_GLOBAL),
    contarTentativa(`login:ip:${ip}`, JANELA_IP, LIMITE_IP),
  ]);

  if (excedeuGlobal || excedeuIp) {
    return Response.json(
      { erro: 'Muitas tentativas. Aguarde alguns minutos.' },
      { status: 429 }
    );
  }

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return Response.json({ erro: 'JSON inválido' }, { status: 400 });
  }

  const { usuario: login, senha } = corpo ?? {};

  if (typeof login !== 'string' || typeof senha !== 'string') {
    return Response.json({ erro: 'Informe usuário e senha.' }, { status: 400 });
  }

  /* Sem estas duas o painel não tem como funcionar, e o erro apareceria lá na
     frente como um 500 sem explicação — na assinatura do cookie, depois de a
     senha já ter sido conferida. Melhor dizer o que falta. */
  const segredo = process.env.SESSAO_SEGREDO;
  if (!segredo || segredo.length < 24) {
    console.error('SESSAO_SEGREDO ausente ou curto demais. Rode: npm run senha');
    return Response.json(
      { erro: 'Servidor sem segredo de sessão configurado. Rode: npm run senha' },
      { status: 500 }
    );
  }

  if (!(await contarUsuarios())) {
    console.error('Nenhuma conta cadastrada. Rode: npm run usuario -- criar admin --dono');
    return Response.json(
      { erro: 'Nenhuma conta cadastrada no servidor. Rode: npm run usuario' },
      { status: 500 }
    );
  }

  const conta = await buscarUsuarioParaLogin(login);

  /* Mesma mensagem para usuário inexistente e senha errada: senão o login vira
     uma forma de descobrir quais contas existem. Pelo mesmo motivo a conferência
     roda mesmo sem conta: responder na hora para um usuário inexistente e depois
     de 28ms para um existente entrega a lista de logins pelo relógio. */
  const confere = await conferirSenha(senha, conta?.senhaHash ?? HASH_FALSO);

  if (!conta || !confere) {
    return Response.json({ erro: 'Usuário ou senha incorretos.' }, { status: 401 });
  }

  await Promise.all([
    zerarTentativa(`login:ip:${ip}`),
    registrarAcessoUsuario(conta.id),
  ]);

  await abrirSessao(conta);

  return Response.json({
    ok: true,
    usuario: { id: conta.id, usuario: conta.usuario, nome: conta.nome, papel: conta.papel },
  });
}

/* ==========================================================================
   POST /api/auth/login   { usuario, senha }  → abre a sessão
   ========================================================================== */

import { conferirSenha } from '@/lib/senha';
import { abrirSessao } from '@/lib/auth';
import { buscarUsuarioParaLogin, registrarAcessoUsuario, contarUsuarios } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Freio contra força bruta. Duas camadas, porque cada uma cobre um buraco da
   outra:

   - Por IP, para não deixar uma origem só varrer senhas. O IP vem de um header
     que o cliente controla, então sozinho ele não vale muito: basta variar o
     x-forwarded-for a cada tentativa para zerar o contador.
   - Um teto global por minuto, que é justamente o que sobrevive a esse truque.
     Conferir uma senha custa ~28ms de scrypt; sem teto, uma enxurrada de
     tentativas prende o processo que também serve a página pública.

   Tudo em memória: reinicia junto com o servidor, o que basta para o painel
   de uma banda. */
const LIMITE_IP     = 8;
const JANELA_IP     = 10 * 60 * 1000;  // 10 min
const LIMITE_GLOBAL = 30;
const JANELA_GLOBAL = 60 * 1000;       // 1 min

const tentativas = new Map();
let global = { n: 0, desde: 0 };

/* Hash descartável com o mesmo formato de um real, para gastar o mesmo tempo
   quando o usuário informado não existe. Nenhuma senha bate com ele. */
const HASH_FALSO = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

/* Sem poda o Map só cresce: entradas de IPs que nunca mais voltam ficam para
   sempre, já que a remoção só acontece em login bem-sucedido. */
function podarVencidos(agora) {
  for (const [chave, reg] of tentativas) {
    if (agora - reg.desde > JANELA_IP) tentativas.delete(chave);
  }
}

function excedeuGlobal(agora) {
  if (agora - global.desde > JANELA_GLOBAL) global = { n: 1, desde: agora };
  else global.n += 1;

  return global.n > LIMITE_GLOBAL;
}

function excedeuIp(ip, agora) {
  // A poda varre o Map inteiro, então só vale a pena quando há o que podar.
  // Chamá-la a cada requisição acima de 1000 entradas transformava a defesa
  // num custo por requisição — exatamente o que o atacante queria.
  if (tentativas.size > 1000) podarVencidos(agora);

  const reg = tentativas.get(ip);

  if (!reg || agora - reg.desde > JANELA_IP) {
    tentativas.set(ip, { n: 1, desde: agora });
    return false;
  }

  reg.n += 1;
  return reg.n > LIMITE_IP;
}

export async function POST(req) {
  const agora = Date.now();

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'local';

  if (excedeuGlobal(agora) || excedeuIp(ip, agora)) {
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
    console.error('SESSAO_SEGREDO ausente ou curto demais no .env.local. Rode: npm run senha');
    return Response.json(
      { erro: 'Servidor sem segredo de sessão configurado. Rode: npm run senha' },
      { status: 500 }
    );
  }

  if (!contarUsuarios()) {
    console.error('Nenhuma conta cadastrada. Rode: npm run usuario -- criar admin --dono');
    return Response.json(
      { erro: 'Nenhuma conta cadastrada no servidor. Rode: npm run usuario' },
      { status: 500 }
    );
  }

  const conta = buscarUsuarioParaLogin(login);

  /* Mesma mensagem para usuário inexistente e senha errada: senão o login vira
     uma forma de descobrir quais contas existem. Pelo mesmo motivo a conferência
     roda mesmo sem conta: responder na hora para um usuário inexistente e depois
     de 28ms para um existente entrega a lista de logins pelo relógio. */
  const confere = await conferirSenha(senha, conta?.senhaHash ?? HASH_FALSO);

  if (!conta || !confere) {
    return Response.json({ erro: 'Usuário ou senha incorretos.' }, { status: 401 });
  }

  tentativas.delete(ip);
  registrarAcessoUsuario(conta.id);
  await abrirSessao(conta);

  return Response.json({
    ok: true,
    usuario: { id: conta.id, usuario: conta.usuario, nome: conta.nome, papel: conta.papel },
  });
}

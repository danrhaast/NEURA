/* ==========================================================================
   Contas do painel, pela linha de comando.

   É o caminho de recuperação: cria a primeira conta num servidor novo e
   destrava o painel quando ninguém mais consegue entrar — o dono esqueceu a
   senha, ou a última conta dona foi excluída. Pelo navegador só um dono cria
   contas, então tem que existir uma porta que não dependa de estar logado.

   Uso:
     npm run usuario                                  lista as contas
     npm run usuario -- criar <usuario> [senha]       cria (gera senha se omitida)
     npm run usuario -- criar <usuario> --dono        cria como dono
     npm run usuario -- senha <usuario> [senha]       troca a senha
     npm run usuario -- papel <usuario> dono|editor   muda o papel
     npm run usuario -- excluir <usuario>             remove a conta
   ========================================================================== */

import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  excluirUsuario,
  buscarUsuarioParaLogin,
  contarDonos,
} from '../src/lib/db.js';

import { criarHash, senhaFraca, sugerirSenha } from '../src/lib/senha.js';

const argv = process.argv.slice(2);
const comando = argv[0] ?? 'listar';
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const args = argv.filter((a) => !a.startsWith('--'));

function sair(msg, codigo = 1) {
  console.error(`\n  ${msg}\n`);
  process.exit(codigo);
}

async function achar(login) {
  const conta = await buscarUsuarioParaLogin(login);
  if (!conta) sair(`Não existe conta com o usuário "${login}".`);
  return conta;
}

async function tabela() {
  const contas = await listarUsuarios();

  if (!contas.length) {
    console.log('\n  Nenhuma conta cadastrada.');
    console.log('  Crie a primeira com:  npm run usuario -- criar admin --dono\n');
    return;
  }

  console.log('\n  Contas do painel:\n');
  for (const u of contas) {
    const quando = u.ultimoAcesso
      ? new Date(u.ultimoAcesso).toLocaleString('pt-BR')
      : 'nunca entrou';
    console.log(`    ${u.usuario.padEnd(22)} ${u.papel.padEnd(8)} ${quando}`);
  }
  console.log('');
}

async function definirSenha(informada) {
  const senha = informada ?? sugerirSenha();

  const fraca = senhaFraca(senha);
  if (fraca) sair(fraca);

  return { senha, hash: await criarHash(senha) };
}

switch (comando) {
  case 'listar': {
    await tabela();
    break;
  }

  case 'criar': {
    const login = args[1];
    if (!login) sair('Informe o usuário:  npm run usuario -- criar <usuario>');

    if (await buscarUsuarioParaLogin(login)) sair(`Já existe uma conta "${login}".`);

    const { senha, hash } = await definirSenha(args[2]);
    const papel = flags.has('--dono') || (await listarUsuarios()).length === 0 ? 'dono' : 'editor';

    const conta = await criarUsuario({ usuario: login, nome: args[3] ?? '', senhaHash: hash, papel });

    console.log(`\n  Conta criada:  ${conta.usuario}  (${conta.papel})`);
    console.log(`  Senha:         ${senha}`);
    console.log('  (guarde — ela não é recuperável a partir do hash)\n');
    break;
  }

  case 'senha': {
    const login = args[1];
    if (!login) sair('Informe o usuário:  npm run usuario -- senha <usuario>');

    const conta = await achar(login);
    const { senha, hash } = await definirSenha(args[2]);
    await atualizarUsuario(conta.id, { senhaHash: hash });

    console.log(`\n  Senha de "${conta.usuario}" trocada.`);
    console.log(`  Nova senha:  ${senha}\n`);
    break;
  }

  case 'papel': {
    const [, login, papel] = args;
    if (!login || !['dono', 'editor'].includes(papel)) {
      sair('Uso:  npm run usuario -- papel <usuario> dono|editor');
    }

    const conta = await achar(login);
    if (conta.papel === 'dono' && papel !== 'dono' && (await contarDonos()) <= 1) {
      sair('Esta é a única conta dona. Promova outra antes de rebaixar esta.');
    }

    await atualizarUsuario(conta.id, { papel });
    console.log(`\n  "${conta.usuario}" agora é ${papel}.\n`);
    break;
  }

  case 'excluir': {
    const login = args[1];
    if (!login) sair('Informe o usuário:  npm run usuario -- excluir <usuario>');

    const conta = await achar(login);
    if (conta.papel === 'dono' && (await contarDonos()) <= 1) {
      sair('Esta é a única conta dona do painel. Crie ou promova outra antes.');
    }

    await excluirUsuario(conta.id);
    console.log(`\n  Conta "${conta.usuario}" excluída.\n`);
    break;
  }

  default:
    sair(`Comando desconhecido: "${comando}". Use listar, criar, senha, papel ou excluir.`);
}

# NEURA

Site da banda Neura — página pública + painel de edição de conteúdo.

Next.js 15 (App Router), React 19, JavaScript. Sem framework de CSS: os estilos
são um mini-framework próprio em `src/styles/`. O conteúdo editável e as contas
do painel ficam em SQLite, lido pelo `node:sqlite` nativo — não há dependência
de banco a instalar.

---

## Requisitos

- **Node 24 ou superior.** O `node:sqlite` só é estável a partir do Node 24; em
  versões anteriores exigiria a flag `--experimental-sqlite`. Há um `.nvmrc` no
  repositório: `nvm use` já pega a versão certa.

## Primeiros passos

```bash
npm install
npm run senha                          # gera o segredo de sessão
```

Copie as linhas geradas para um arquivo `.env.local` novo:

```
SESSAO_SEGREDO=...
NEXT_PUBLIC_SITE_URL=https://seudominio.com
```

Depois crie a conta que vai administrar o painel:

```bash
npm run usuario -- criar admin --dono
```

O comando imprime a senha uma única vez — ela não é recuperável a partir do
hash. Para escolher a senha você mesmo: `npm run usuario -- criar admin MinhaSenha123 --dono`.

Então:

```bash
npm run dev              # http://localhost:3000  ·  painel em /admin
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm start` | sobe o build de produção |
| `npm run lint` | ESLint |
| `npm run senha` | gera o segredo de sessão |
| `npm run usuario` | administra as contas do painel |

---

## O painel

`/admin` — fora do índice dos buscadores, sem link a partir do site público. A
sessão é conferida no servidor antes de qualquer tela renderizar: sem login, o
que chega ao navegador é só o formulário.

| Tela | O que edita |
|---|---|
| Início | dashboard: movimento do site e atalho para cada painel |
| Shows | a barra de progresso da agenda na home |
| Sobre Nós | os dois parágrafos de apresentação e a foto da banda |
| Poemas | os cards do carrossel |
| Vídeos | a grade de vídeos, com capa puxada do YouTube |
| Usuários | as contas com acesso ao painel (só para o dono) |

Cada painel publica só a sua seção: dois painéis abertos ao mesmo tempo não
sobrescrevem um ao outro. Dentro de uma seção a gravação é atômica — entra
inteira ou não entra.

Para acrescentar um painel novo, a lista fica em `src/lib/papeis.js`. Uma
entrada lá já aparece no menu e no dashboard, com o papel que pode vê-la; só
falta criar a página em `src/app/admin/`.

### Contas e papéis

**Não existe cadastro público.** Contas nascem de duas portas: o painel de
Usuários, que exige sessão de dono, ou a linha de comando.

| Papel | Pode |
|---|---|
| **Dono** | tudo, incluindo criar, promover, rebaixar e excluir contas |
| **Editor** | editar o conteúdo do site; não enxerga a área de contas |

Duas travas impedem o painel de ficar sem administrador: ninguém exclui a
própria conta, e o último dono não pode ser rebaixado nem removido.

```bash
npm run usuario                                  # lista as contas
npm run usuario -- criar <usuario> [senha]       # cria (gera senha se omitida)
npm run usuario -- criar <usuario> --dono        # cria como dono
npm run usuario -- senha <usuario> [senha]       # troca a senha
npm run usuario -- papel <usuario> dono|editor   # muda o papel
npm run usuario -- excluir <usuario>             # remove a conta
```

Este é também o caminho de recuperação: é por aqui que se destrava o painel
quando o dono esquece a senha, já que pela web só um dono resolve isso.

**Autenticação.** A senha é guardada como hash scrypt e conferida no servidor —
nunca volta para o navegador. O login devolve um cookie `httpOnly` assinado com
HMAC-SHA256, válido por 8 horas, inacessível ao JavaScript da página. O token
carrega o id da conta, e o servidor relê o usuário no banco a cada requisição:
excluir uma conta ou rebaixar um papel vale na hora, sem esperar o cookie
vencer. Contra força bruta há um limite de 8 tentativas por IP a cada 10
minutos e um teto global por minuto, ambos em memória.

### Medição de acesso

O dashboard mostra visitas e visitantes únicos do próprio site, sem serviço
externo. **Não guarda IP, não usa cookie e não segue ninguém entre sessões:** a
coluna `visitante` é um HMAC de (IP + user-agent + data) que troca sozinho toda
meia-noite, o que permite contar únicos do dia sem manter identificador durável.
Da URL de origem fica só o domínio. Robôs declarados são descartados, e o
registro é podado aos 180 dias.

Quem navega com JavaScript desligado não é contado — a visita é avisada pelo
navegador depois que a página carrega, e não durante o render, justamente para
não contar robô e pré-carregamento.

---

## Como o conteúdo funciona

A home é um Server Component: lê o SQLite direto, sem passar por `fetch`, e
entrega o HTML pronto. Funciona com o JavaScript desligado e não depende de
cache — o que for publicado no painel aparece no próximo carregamento.

## Onde os dados ficam

Em `data/neura.db`, criado e populado com o conteúdo inicial na primeira
execução. O diretório `data/` está no `.gitignore`.

> **Isto define onde o site pode ser hospedado.** O banco é um arquivo no disco
> do processo, então **Vercel, Netlify e afins não servem**: nessas plataformas o
> filesystem é efêmero e toda publicação feita no painel — e toda conta criada —
> seria perdida. Use um host com disco persistente e Node 24 — VPS, Fly.io,
> Railway, Render. Se um dia for preciso ir para serverless, o caminho é trocar o
> `node:sqlite` por Turso ou Postgres; só `src/lib/db.js` muda.

**Faça backup do `data/neura.db`.** É o único lugar onde o conteúdo publicado,
as contas e o histórico de acesso existem.

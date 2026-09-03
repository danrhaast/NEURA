# NEURA

Site da banda Neura — página pública + painel de edição de conteúdo.

Next.js 15 (App Router), React 19, JavaScript. Sem framework de CSS: os estilos
são um mini-framework próprio em `src/styles/`. O conteúdo editável e as contas
do painel ficam em SQLite, acessado pelo cliente libSQL: um arquivo em disco no
desenvolvimento, o Turso em produção — o mesmo código nos dois casos.

---

## Requisitos

- **Node 24 ou superior.** Há um `.nvmrc` no repositório: `nvm use` já pega a
  versão certa. É a versão usada também no Vercel.

## Primeiros passos

```bash
npm install
npm run senha                          # gera o segredo de sessão
```

Copie as linhas geradas para um arquivo `.env.local` novo:

```
SESSAO_SEGREDO=...
```

Sem `TURSO_DATABASE_URL` o banco cai em `file:data/neura.db`, que é o que você
quer no desenvolvimento.

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
| `npm run migrar` | copia o banco local para o Turso |

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
minutos e um teto global de 30 por minuto — este último é o que sobrevive a um
`x-forwarded-for` forjado, já que o IP vem de um cabeçalho que o cliente
controla. Os contadores ficam no banco, não em memória: no serverless cada
invocação pode cair numa instância nova, e um contador local daria ao atacante
um placar zerado a cada requisição.

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

A home é um Server Component: consulta o banco sem passar por `fetch` e entrega
o HTML pronto. Funciona com o JavaScript desligado e não depende de cache — o
que for publicado no painel aparece no próximo carregamento.

## Onde os dados ficam

O acesso é sempre pelo cliente libSQL; o que muda entre os ambientes é só a URL
em `TURSO_DATABASE_URL`:

| | URL | Onde vive |
|---|---|---|
| Desenvolvimento | `file:data/neura.db` (padrão) | arquivo em disco, ignorado pelo git |
| Produção | `libsql://SEU-BANCO.turso.io` | Turso |

> **No Vercel o banco tem que ficar fora do processo.** O filesystem lá é
> efêmero: com uma URL `file:` em produção, o painel diria "publicado" e o
> conteúdo — junto com as contas criadas — sumiria no próximo cold start.

Um banco local existente não é sobrescrito: na primeira abertura o esquema é
completado com as tabelas novas e o conteúdo já presente é mantido.

**Backup.** Em produção é o Turso que guarda tudo — conteúdo, contas e histórico
de acesso — e ele tem cópia de segurança própria. No banco local, copiar só o
`data/neura.db` **não basta**: em modo WAL as escritas recentes ficam no
`neura.db-wal`, então leve os três arquivos (`.db`, `-wal`, `-shm`) ou nada
garante que a cópia esteja completa.

---

## Publicar no Vercel

1. **Crie o banco no Turso** e guarde a URL `libsql://` e o token.

2. **Leve o banco local para lá** — sem este passo a produção nasce só com o
   conteúdo inicial, e a conta do painel fica para trás:

   ```bash
   npm run migrar
   ```

   Copia poemas, vídeos, configurações e contas. O histórico de acesso fica de
   fora de propósito: visitas ao ambiente local não são visitas do site.

3. **Cadastre as variáveis** no projeto do Vercel:

   | Variável | Valor |
   |---|---|
   | `SESSAO_SEGREDO` | saída de `npm run senha` |
   | `TURSO_DATABASE_URL` | `libsql://SEU-BANCO.turso.io` |
   | `TURSO_AUTH_TOKEN` | o token do Turso |
   | `NEXT_PUBLIC_SITE_URL` | só quando houver domínio próprio |
   | `SITE_FUSO_MINUTOS` | opcional; padrão `-180` (Brasília) |

   Sem `NEXT_PUBLIC_SITE_URL` o endereço público é deduzido do domínio de
   produção do próprio Vercel, então OpenGraph, `robots.txt` e `sitemap.xml`
   saem certos desde o primeiro deploy.

4. **Faça o deploy.** O projeto roda em Node 24, que é o que o `.nvmrc` e o
   campo `engines` do `package.json` pedem.

> O plano Hobby do Vercel é para **uso não-comercial**. As diretrizes deles
> listam divulgar um produto ou serviço e pedir doações como uso comercial —
> vale conferir antes de anunciar shows ou vender merch pelo site.

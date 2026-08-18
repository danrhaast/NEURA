# NEURA

Site da banda Neura — página pública + painel de edição de conteúdo.

Next.js 15 (App Router), React 19, JavaScript. Sem framework de CSS: os estilos
são um mini-framework próprio em `src/styles/`. O conteúdo editável fica em
SQLite, lido pelo `node:sqlite` nativo — não há dependência de banco a instalar.

---

## Requisitos

- **Node 24 ou superior.** O `node:sqlite` só é estável a partir do Node 24; em
  versões anteriores exigiria a flag `--experimental-sqlite`. Há um `.nvmrc` no
  repositório: `nvm use` já pega a versão certa.

## Primeiros passos

```bash
npm install
npm run senha            # gera a senha do painel e o segredo de sessão
```

O comando imprime três coisas: a senha em texto (guarde — não dá para recuperar
a partir do hash) e duas linhas para colar num arquivo `.env.local` novo:

```
ADMIN_SENHA_HASH=...
SESSAO_SEGREDO=...
NEXT_PUBLIC_SITE_URL=https://seudominio.com
```

Para definir a senha você mesmo: `npm run senha -- minhaSenha`.

Depois:

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
| `npm run senha` | gera hash de senha + segredo de sessão |

---

## Como o conteúdo funciona

A home é um Server Component: lê o SQLite direto, sem passar por `fetch`, e
entrega o HTML pronto. Funciona com o JavaScript desligado e não depende de
cache — o que for publicado no painel aparece no próximo carregamento.

O painel (`/admin`) manda a edição inteira de uma vez num `PUT /api/conteudo`.
A gravação é atômica: poemas, vídeos e o progresso dos shows entram na mesma
transação, ou nenhum entra.

**Autenticação.** A senha é conferida no servidor e nunca volta para o
navegador. O login devolve um cookie `httpOnly` assinado com HMAC-SHA256, válido
por 8 horas — inacessível ao JavaScript da página. Há um limite de 8 tentativas
por IP a cada 10 minutos, em memória.

## Onde os dados ficam

Em `data/neura.db`, criado e populado com o conteúdo inicial na primeira
execução. O diretório `data/` está no `.gitignore`.

> **Isto define onde o site pode ser hospedado.** O banco é um arquivo no disco
> do processo, então **Vercel, Netlify e afins não servem**: nessas plataformas o
> filesystem é efêmero e toda publicação feita no painel seria perdida. Use um
> host com disco persistente e Node 24 — VPS, Fly.io, Railway, Render. Se um dia
> for preciso ir para serverless, o caminho é trocar o `node:sqlite` por Turso ou
> Postgres; só `src/lib/db.js` muda.

**Faça backup do `data/neura.db`.** É o único lugar onde o conteúdo publicado
existe.

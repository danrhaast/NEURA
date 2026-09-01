/* ==========================================================================
   Dashboard — a primeira tela de quem entra no painel.

   Responde duas perguntas: o que dá para editar, e como anda o movimento do
   site. Server Component: lê o banco direto, sem passar por fetch.
   ========================================================================== */

import Link from 'next/link';

import { sessao } from '@/lib/auth';
import { lerConteudo, lerMetricas, contarUsuarios } from '@/lib/db';
import { paineisDe } from '@/lib/papeis';

import Icone from '@/components/admin/Icone';
import GraficoAcessos from '@/components/admin/GraficoAcessos';

export const dynamic = 'force-dynamic';

/* Cada cartão mostra o estado atual da sua seção, para o dashboard dizer algo
   de útil antes de a pessoa clicar. */
function resumoDoPainel(id, { poemas, videos, progressoShows, sobre }, nUsuarios) {
  switch (id) {
    case 'poemas':
      return poemas.length
        ? `${poemas.length} ${poemas.length === 1 ? 'poema publicado' : 'poemas publicados'}`
        : 'Nenhum poema — a seção fica vazia';

    case 'videos': {
      const semLink = videos.filter((v) => !v.youtube?.trim()).length;
      if (!videos.length) return 'Nenhum vídeo — a seção fica vazia';
      return semLink
        ? `${videos.length} vídeos · ${semLink} sem link do YouTube`
        : `${videos.length} ${videos.length === 1 ? 'vídeo publicado' : 'vídeos publicados'}`;
    }

    case 'shows':
      return `Barra da agenda em ${progressoShows}%`;

    case 'sobre':
      return sobre.foto?.trim() ? 'Texto e foto publicados' : 'Texto publicado · sem foto da banda';

    case 'usuarios':
      return `${nUsuarios} ${nUsuarios === 1 ? 'conta com acesso' : 'contas com acesso'}`;

    default:
      return '';
  }
}

function Kpi({ rotulo, valor, apoio }) {
  return (
    <div className="kpi">
      <span className="kpi__rotulo n-hud">{rotulo}</span>
      <strong className="kpi__valor">{valor}</strong>
      {apoio && <span className="kpi__apoio">{apoio}</span>}
    </div>
  );
}

export default async function Dashboard() {
  const usuario = await sessao();

  const conteudo = lerConteudo();
  const metricas = lerMetricas(14);
  const nUsuarios = contarUsuarios();
  const paineis = paineisDe(usuario.papel);

  const primeiroNome = (usuario.nome || usuario.usuario).split(' ')[0];

  return (
    <div className="dash">

      <header className="phead phead--simples">
        <div className="phead__texto">
          <h1 className="phead__titulo">Olá, {primeiroNome}</h1>
          <p className="phead__resumo">
            Tudo que você publicar aqui aparece no site no próximo carregamento.
          </p>
        </div>
      </header>

      {/* --- movimento do site ------------------------------------------- */}

      <section className="dash__bloco">
        <div className="kpis">
          <Kpi rotulo="Hoje"        valor={metricas.hoje}      apoio={`${metricas.visitantesHoje} visitantes únicos`} />
          <Kpi rotulo="7 dias"      valor={metricas.ultimos7}  apoio={`${metricas.visitantes7} visitantes únicos`} />
          <Kpi rotulo="30 dias"     valor={metricas.ultimos30} />
          <Kpi rotulo="Desde o começo" valor={metricas.total} />
        </div>

        <div className="dash__duas">
          <div className="cartao">
            <GraficoAcessos serie={metricas.serie} dias={metricas.dias} />
          </div>

          <div className="cartao">
            <h2 className="cartao__titulo">De onde vieram</h2>
            <p className="cartao__hint">Origens dos últimos {metricas.dias} dias</p>

            {metricas.origens.length === 0 ? (
              <p className="empty">
                Ninguém chegou por link de outro site ainda — ou vieram digitando o
                endereço direto, o que não deixa origem.
              </p>
            ) : (
              <ul className="origens">
                {metricas.origens.map((o) => (
                  <li key={o.origem}>
                    <span className="origens__nome">{o.origem}</span>
                    <span className="origens__n n-hud">{o.visitas}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="cartao__nota">
              A medição é do próprio site: não guarda IP nem usa cookie, e conta
              visitantes únicos por um identificador que troca todo dia.
            </p>
          </div>
        </div>
      </section>

      {/* --- painéis ------------------------------------------------------ */}

      <section className="dash__bloco">
        <h2 className="dash__titulo">O que você pode editar</h2>

        <div className="cards">
          {paineis.map((p) => (
            <Link key={p.id} href={p.href} className="card">
              <span className="card__icone"><Icone nome={p.icone} /></span>
              <span className="card__nome">{p.nome}</span>
              <span className="card__resumo">{p.resumo}</span>
              <span className="card__estado n-hud">
                {resumoDoPainel(p.id, conteudo, nUsuarios)}
              </span>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}

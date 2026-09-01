/* ==========================================================================
   GRAFICOACESSOS — visitas por dia

   Série única: só "visitas". Visitantes únicos aparecem nos cartões do topo e
   na dica de cada coluna, não como uma segunda barra — 14 dias já apertam o
   espaço, e duas barras por dia dobrariam a densidade sem responder nenhuma
   pergunta a mais.

   Uma série dispensa legenda: o título nomeia o que está desenhado. O rótulo
   direto aparece só no maior dia; número em cima de toda coluna vira ruído.

   Sem JavaScript e sem biblioteca — as colunas são divs e a dica é CSS. Os
   mesmos dados saem também como tabela, logo abaixo, para leitor de tela e
   para quem preferir os números crus.
   ========================================================================== */

const DIA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function formatarDia(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  return {
    curto: `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`,
    semana: DIA_SEMANA[d.getDay()],
  };
}

export default function GraficoAcessos({ serie, dias }) {
  const teto = Math.max(...serie.map((p) => p.visitas), 1);
  const totalPeriodo = serie.reduce((s, p) => s + p.visitas, 0);

  // Marca só a coluna mais alta. Com empate, a primeira delas.
  const iMaior = totalPeriodo ? serie.findIndex((p) => p.visitas === teto) : -1;

  return (
    <section className="grafico">
      <header className="grafico__head">
        <div>
          <h2 className="cartao__titulo">Visitas por dia</h2>
          <p className="cartao__hint">Últimos {dias} dias · {totalPeriodo} visitas no período</p>
        </div>
        <span className="grafico__teto n-hud">pico {teto}</span>
      </header>

      {totalPeriodo === 0 ? (
        <p className="empty">
          Nenhuma visita registrada ainda. Os números aparecem conforme as pessoas
          abrem o site.
        </p>
      ) : (
        <>
          <div className="grafico__plot" role="img"
               aria-label={`Visitas por dia nos últimos ${dias} dias. Total de ${totalPeriodo} visitas, pico de ${teto} em um dia. Os números completos estão na tabela abaixo.`}>
            {/* Linhas de apoio: discretas, atrás das colunas. */}
            <div className="grafico__grade" aria-hidden="true">
              <span /><span /><span /><span />
            </div>

            <ol className="grafico__barras">
              {serie.map((p, i) => {
                const altura = (p.visitas / teto) * 100;
                const { curto, semana } = formatarDia(p.dia);

                return (
                  <li className="barra" key={p.dia}>
                    <div
                      className={'barra__haste' + (i === iMaior ? ' is-pico' : '')}
                      /* Um fio de altura mesmo no zero, para o dia não sumir do eixo. */
                      style={{ height: `max(2px, ${altura}%)` }}
                      tabIndex={0}
                    >
                      {/* Ancorados na coluna, não na célula: a altura varia, e só
                          assim o rótulo acompanha o topo dela. */}
                      {i === iMaior && <span className="barra__valor">{p.visitas}</span>}

                      <span className="barra__dica">
                        <strong>{curto}</strong>
                        {p.visitas} visita{p.visitas === 1 ? '' : 's'}
                        {' · '}
                        {p.visitantes} visitante{p.visitantes === 1 ? '' : 's'}
                      </span>
                    </div>

                    {/* No celular só cabem as pontas e o meio da série. */}
                    <span className={'barra__eixo n-hud' + (
                      i === 0 || i === serie.length - 1 || i === Math.floor(serie.length / 2)
                        ? ' is-marco' : ''
                    )}>
                      {curto.slice(0, 2)}
                      <em>{semana}</em>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <details className="grafico__tabela">
            <summary className="n-hud">Ver os números</summary>
            <table>
              <caption className="n-sr">Visitas e visitantes únicos por dia</caption>
              <thead>
                <tr><th scope="col">Dia</th><th scope="col">Visitas</th><th scope="col">Visitantes</th></tr>
              </thead>
              <tbody>
                {serie.map((p) => (
                  <tr key={p.dia}>
                    <th scope="row">{formatarDia(p.dia).curto}</th>
                    <td>{p.visitas}</td>
                    <td>{p.visitantes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}

'use client';

import { useCallback } from 'react';

import Cabecalho, { Aviso } from '@/components/admin/Cabecalho';
import { useEdicao } from '@/components/admin/useEdicao';

export default function PainelShows({ inicial }) {
  const montar = useCallback((progresso) => ({ progressoShows: progresso }), []);
  const { dados: progresso, alterar, sujo, salvando, aviso, salvar, descartar } =
    useEdicao(inicial, montar);

  return (
    <>
      <Cabecalho
        titulo="Shows"
        resumo="A barra de progresso da seção “Shows em breve...” na home."
        sujo={sujo}
        salvando={salvando}
        onSalvar={salvar}
        onDescartar={descartar}
      />

      <section className="asec">
        <h2 className="asec__titulo">Progresso da agenda</h2>
        <p className="asec__hint">
          Quanto a barra do site aparece preenchida. Use como termômetro de quão
          perto a agenda está de sair — em 0% a barra fica vazia.
        </p>

        <div className="slider n-mt-5">
          <input
            className="slider__range"
            type="range"
            min="0"
            max="100"
            value={progresso}
            onChange={(e) => alterar(Number(e.target.value))}
            aria-label="Progresso da agenda de shows"
          />
          <span className="slider__val">{progresso}%</span>
        </div>

        <div className="atalhos n-mt-4">
          {[0, 25, 50, 75, 100].map((v) => (
            <button
              key={v}
              className={'atalho' + (progresso === v ? ' is-active' : '')}
              onClick={() => alterar(v)}
            >
              {v}%
            </button>
          ))}
        </div>
      </section>

      <section className="asec">
        <h2 className="asec__titulo">Prévia</h2>
        <p className="asec__hint">É assim que a barra fica no site.</p>

        <div className="n-progress n-mt-5">
          <div
            className="n-progress__track"
            role="progressbar"
            aria-valuenow={progresso}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Prévia do progresso"
          >
            <div className="n-progress__fill" style={{ '--p': `${progresso}%` }} />
          </div>
          <span className="n-progress__value">{progresso}%</span>
        </div>
      </section>

      <Aviso aviso={aviso} />
    </>
  );
}

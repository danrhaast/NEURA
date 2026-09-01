'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback } from 'react';

import Cabecalho, { Aviso } from '@/components/admin/Cabecalho';
import { useEdicao } from '@/components/admin/useEdicao';

const MAX_TEXTO = 1200;

export default function PainelSobre({ inicial }) {
  const montar = useCallback((sobre) => ({ sobre }), []);
  const { dados, alterar, sujo, salvando, aviso, salvar, descartar } =
    useEdicao(inicial, montar);

  const campo = (chave) => (e) => alterar((d) => ({ ...d, [chave]: e.target.value }));

  const foto = dados.foto?.trim();

  return (
    <>
      <Cabecalho
        titulo="Sobre Nós"
        resumo="O texto de apresentação e a foto da banda na home."
        sujo={sujo}
        salvando={salvando}
        onSalvar={salvar}
        onDescartar={descartar}
      />

      <section className="asec">
        <h2 className="asec__titulo">Texto de apresentação</h2>
        <p className="asec__hint">
          Dois parágrafos, exibidos ao lado da foto. Deixar um deles em branco
          simplesmente o remove do site.
        </p>

        <div className="n-mt-5">
          <label className="n-label" htmlFor="p1">Primeiro parágrafo</label>
          <textarea
            className="n-input n-input--alto"
            id="p1"
            value={dados.p1 ?? ''}
            maxLength={MAX_TEXTO}
            onChange={campo('p1')}
          />
          <Contador valor={dados.p1} max={MAX_TEXTO} />
        </div>

        <div className="n-mt-5">
          <label className="n-label" htmlFor="p2">Segundo parágrafo</label>
          <textarea
            className="n-input n-input--alto"
            id="p2"
            value={dados.p2 ?? ''}
            maxLength={MAX_TEXTO}
            onChange={campo('p2')}
          />
          <Contador valor={dados.p2} max={MAX_TEXTO} />
        </div>
      </section>

      <section className="asec">
        <h2 className="asec__titulo">Foto da banda</h2>
        <p className="asec__hint">
          O painel não guarda arquivos — informe o endereço de uma imagem já
          publicada na internet. Sem endereço, o site mostra a moldura vazia
          escrita “Foto da banda”.
        </p>

        <div className="n-mt-5">
          <label className="n-label" htmlFor="foto">Endereço da imagem</label>
          <input
            className="n-input"
            id="foto"
            type="url"
            value={dados.foto ?? ''}
            maxLength={400}
            placeholder="https://.../banda.jpg"
            onChange={campo('foto')}
          />
        </div>

        <div className="n-mt-5">
          <label className="n-label" htmlFor="alt">Descrição da imagem</label>
          <input
            className="n-input"
            id="alt"
            value={dados.fotoAlt ?? ''}
            maxLength={160}
            placeholder="A banda Neura no palco"
            onChange={campo('fotoAlt')}
          />
          <p className="help">
            Lida em voz alta por leitores de tela e exibida se a imagem não carregar.
          </p>
        </div>

        <div className="fprev n-mt-5">
          {foto
            ? <img src={foto} alt={dados.fotoAlt || 'Prévia da foto da banda'} />
            : <div className="fprev__vazio">Foto da banda</div>}
          <span className="n-hud">Prévia</span>
        </div>
      </section>

      <Aviso aviso={aviso} />
    </>
  );
}

function Contador({ valor, max }) {
  const n = (valor ?? '').length;
  return (
    <p className={'help help--contador' + (n >= max ? ' help--bad' : '')}>
      {n} / {max} caracteres
    </p>
  );
}

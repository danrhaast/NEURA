'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback } from 'react';

import Cabecalho, { Aviso } from '@/components/admin/Cabecalho';
import ItemBarra, { useLista } from '@/components/admin/ItemBarra';
import { useEdicao } from '@/components/admin/useEdicao';
import { ytId, capaYoutube } from '@/lib/youtube';

const NOVO = () => ({ titulo: 'Novo vídeo', legenda: 'Clipe oficial', youtube: '' });

export default function PainelVideos({ inicial }) {
  const montar = useCallback((videos) => ({ videos }), []);
  const { dados: videos, alterar, sujo, salvando, aviso, notificar, salvar, descartar } =
    useEdicao(inicial, montar);

  const { mover, excluir, editar, adicionar } = useLista(alterar);

  const semLink = videos.filter((v) => !ytId(v.youtube)).length;

  async function publicar() {
    const semTitulo = videos.filter((v) => !v.titulo?.trim()).length;
    if (semTitulo && !confirm(`${semTitulo} vídeo(s) sem título. Publicar mesmo assim?`)) return;
    await salvar();
  }

  function novo() {
    if (videos.length >= 200) {
      notificar('Limite de 200 vídeos atingido', true);
      return;
    }
    adicionar(NOVO());
  }

  return (
    <>
      <Cabecalho
        titulo="Vídeos"
        resumo="A grade de vídeos na home. A capa vem do próprio YouTube."
        sujo={sujo}
        salvando={salvando}
        onSalvar={publicar}
        onDescartar={descartar}
        extra={
          <button className="n-btn n-btn--sm n-btn--violet" onClick={novo}>
            + Novo vídeo
          </button>
        }
      />

      {semLink > 0 && videos.length > 0 && (
        <p className="alerta">
          {semLink === videos.length
            ? 'Nenhum vídeo tem link do YouTube.'
            : `${semLink} de ${videos.length} vídeos estão sem link do YouTube.`}
          {' '}No site eles aparecem sem capa e o clique leva para a seção de redes.
        </p>
      )}

      <section className="asec">
        {videos.length === 0 ? (
          <p className="empty">
            Nenhum vídeo. A seção fica vazia no site — use “Novo vídeo” para começar.
          </p>
        ) : (
          <div className="items">
            {videos.map((v, i) => (
              <article className="item" key={v.id ?? `novo-${i}`}>
                <ItemBarra
                  i={i}
                  total={videos.length}
                  nome={v.titulo}
                  onMover={(d) => mover(i, d)}
                  onExcluir={() => excluir(i, v.titulo)}
                />

                <div className="item__body">
                  <div className="field2">
                    <div>
                      <label className="n-label" htmlFor={`vt${i}`}>Título</label>
                      <input
                        className="n-input"
                        id={`vt${i}`}
                        value={v.titulo ?? ''}
                        maxLength={80}
                        onChange={(e) => editar(i, 'titulo', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="n-label" htmlFor={`vl${i}`}>Legenda</label>
                      <input
                        className="n-input"
                        id={`vl${i}`}
                        value={v.legenda ?? ''}
                        maxLength={60}
                        onChange={(e) => editar(i, 'legenda', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="n-label" htmlFor={`vy${i}`}>Link do YouTube</label>
                    <input
                      className="n-input"
                      id={`vy${i}`}
                      value={v.youtube ?? ''}
                      maxLength={300}
                      placeholder="https://www.youtube.com/watch?v=..."
                      onChange={(e) => editar(i, 'youtube', e.target.value)}
                    />
                    <Previa valor={v.youtube} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Aviso aviso={aviso} />
    </>
  );
}

function Previa({ valor }) {
  const bruto = String(valor ?? '').trim();
  const id = ytId(bruto);

  if (!bruto) {
    return (
      <>
        <p className="help">Sem link — o site mostra a miniatura genérica.</p>
        <div className="vprev">
          <div className="vprev__none">sem capa</div>
          <span className="n-hud">Miniatura genérica</span>
        </div>
      </>
    );
  }

  if (!id) {
    return (
      <>
        <p className="help help--bad">Link não reconhecido. Use o endereço completo do vídeo.</p>
        <div className="vprev">
          <div className="vprev__none">inválido</div>
          <span className="n-hud">Sem capa</span>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="help help--ok">Link reconhecido — ID {id}</p>
      <div className="vprev">
        <img src={capaYoutube(id, 'mqdefault')} alt="" />
        <span className="n-hud">Capa do YouTube</span>
      </div>
    </>
  );
}

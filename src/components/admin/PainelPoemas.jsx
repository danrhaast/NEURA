'use client';

import { useCallback } from 'react';

import Cabecalho, { Aviso } from '@/components/admin/Cabecalho';
import ItemBarra, { useLista } from '@/components/admin/ItemBarra';
import { useEdicao } from '@/components/admin/useEdicao';

const NOVO = () => ({ titulo: 'Novo poema', texto: 'Primeira linha\nSegunda linha' });

const MAX_TITULO = 80;
const MAX_TEXTO  = 2000;

export default function PainelPoemas({ inicial }) {
  const montar = useCallback((poemas) => ({ poemas }), []);
  const { dados: poemas, alterar, sujo, salvando, aviso, notificar, salvar, descartar } =
    useEdicao(inicial, montar);

  const { mover, excluir, editar, adicionar } = useLista(alterar);

  async function publicar() {
    const semTitulo = poemas.filter((p) => !p.titulo?.trim()).length;
    if (semTitulo && !confirm(`${semTitulo} poema(s) sem título. Publicar mesmo assim?`)) return;
    await salvar();
  }

  function novo() {
    if (poemas.length >= 200) {
      notificar('Limite de 200 poemas atingido', true);
      return;
    }
    adicionar(NOVO());
  }

  return (
    <>
      <Cabecalho
        titulo="Poemas"
        resumo="Os cards do carrossel na home. A numeração segue a ordem desta lista."
        sujo={sujo}
        salvando={salvando}
        onSalvar={publicar}
        onDescartar={descartar}
        extra={
          <button className="n-btn n-btn--sm n-btn--violet" onClick={novo}>
            + Novo poema
          </button>
        }
      />

      <section className="asec">
        {poemas.length === 0 ? (
          <p className="empty">
            Nenhum poema. A seção fica vazia no site — use “Novo poema” para começar.
          </p>
        ) : (
          <div className="items">
            {poemas.map((p, i) => (
              <article className="item" key={p.id ?? `novo-${i}`}>
                <ItemBarra
                  i={i}
                  total={poemas.length}
                  nome={p.titulo}
                  onMover={(d) => mover(i, d)}
                  onExcluir={() => excluir(i, p.titulo)}
                />

                <div className="item__body">
                  <div>
                    <label className="n-label" htmlFor={`pt${i}`}>Título</label>
                    <input
                      className="n-input"
                      id={`pt${i}`}
                      value={p.titulo ?? ''}
                      maxLength={MAX_TITULO}
                      onChange={(e) => editar(i, 'titulo', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="n-label" htmlFor={`px${i}`}>Texto</label>
                    <textarea
                      className="n-input n-input--alto"
                      id={`px${i}`}
                      value={p.texto ?? ''}
                      maxLength={MAX_TEXTO}
                      onChange={(e) => editar(i, 'texto', e.target.value)}
                    />
                    <p className="help">
                      Cada quebra de linha vira uma linha no card — o verso é
                      preservado como você escrever aqui.
                    </p>
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

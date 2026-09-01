'use client';

/* Cabeçalho de cada item nas listas de poemas e vídeos: posição, nome e as
   ações de reordenar e excluir. */
export default function ItemBarra({ i, total, nome, onMover, onExcluir }) {
  return (
    <div className="item__bar">
      <span className="item__num">{String(i + 1).padStart(2, '0')}</span>
      <span className="item__name">{nome?.trim() || 'sem título'}</span>

      <div className="item__acts">
        <button className="iact" onClick={() => onMover(-1)} disabled={i === 0} aria-label={`Mover ${nome || 'item'} para cima`}>▲</button>
        <button className="iact" onClick={() => onMover(1)} disabled={i === total - 1} aria-label={`Mover ${nome || 'item'} para baixo`}>▼</button>
        <button className="iact iact--del" onClick={onExcluir} aria-label={`Excluir ${nome || 'item'}`}>✕</button>
      </div>
    </div>
  );
}

/**
 * Reordenar e excluir são idênticos nos dois painéis; só muda o que está na
 * lista. Devolve os manipuladores já ligados ao `alterar` do useEdicao.
 */
export function useLista(alterar) {
  const mover = (i, dir) =>
    alterar((lista) => {
      const j = i + dir;
      if (j < 0 || j >= lista.length) return lista;
      const nova = [...lista];
      [nova[i], nova[j]] = [nova[j], nova[i]];
      return nova;
    });

  const excluir = (i, nome) => {
    if (!confirm(`Excluir "${nome?.trim() || 'este item'}"?`)) return;
    alterar((lista) => lista.filter((_, k) => k !== i));
  };

  const editar = (i, campo, valor) =>
    alterar((lista) => lista.map((it, k) => (k === i ? { ...it, [campo]: valor } : it)));

  const adicionar = (novo) => alterar((lista) => [...lista, novo]);

  return { mover, excluir, editar, adicionar };
}

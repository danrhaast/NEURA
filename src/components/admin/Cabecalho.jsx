'use client';

/* Topo repetido por todo painel de conteúdo: título, estado da publicação e as
   ações. Fica grudado no alto para o botão Publicar continuar ao alcance em
   listas longas de poemas. */
export default function Cabecalho({
  titulo,
  resumo,
  sujo,
  salvando,
  onSalvar,
  onDescartar,
  extra,
}) {
  return (
    <header className="phead">
      <div className="phead__texto">
        <h1 className="phead__titulo">{titulo}</h1>
        {resumo && <p className="phead__resumo">{resumo}</p>}
      </div>

      <div className="phead__acoes">
        {extra}

        <span className={'phead__estado n-hud' + (sujo ? ' is-dirty' : '')}>
          {sujo ? 'Alterações não salvas' : 'Tudo publicado'}
        </span>

        <button className="n-btn n-btn--sm" onClick={onDescartar} disabled={!sujo || salvando}>
          Descartar
        </button>

        <button
          className="n-btn n-btn--sm n-btn--solid"
          onClick={onSalvar}
          disabled={salvando || !sujo}
        >
          {salvando ? 'Publicando...' : 'Publicar'}
        </button>
      </div>
    </header>
  );
}

/** Aviso flutuante de sucesso ou erro. */
export function Aviso({ aviso }) {
  if (!aviso) return null;

  return (
    <div className={'toast is-on' + (aviso.ruim ? ' is-bad' : '')} role="status">
      {aviso.texto}
    </div>
  );
}

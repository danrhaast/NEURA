'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ytId, capaYoutube } from '@/lib/youtube';

const POEMA_NOVO = () => ({ titulo: 'Novo poema', texto: 'Primeira linha\nSegunda linha' });
const VIDEO_NOVO = () => ({ titulo: 'Novo vídeo', legenda: 'Clipe oficial', youtube: '' });

export default function Editor({ aoSair }) {
  const [poemas, setPoemas]   = useState([]);
  const [videos, setVideos]   = useState([]);
  const [progresso, setProg]  = useState(0);

  const [aba, setAba]         = useState('poemas');
  const [carregando, setCarr] = useState(true);
  const [salvando, setSalv]   = useState(false);
  const [sujo, setSujo]       = useState(false);
  const [aviso, setAviso]     = useState(null);   // { texto, ruim }

  const timerAviso = useRef(null);

  const notificar = useCallback((texto, ruim = false) => {
    setAviso({ texto, ruim });
    clearTimeout(timerAviso.current);
    timerAviso.current = setTimeout(() => setAviso(null), 3000);
  }, []);

  /* --- carregar ---------------------------------------------------------- */

  const carregar = useCallback(async () => {
    setCarr(true);
    try {
      const r = await fetch('/api/conteudo', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setPoemas(d.poemas ?? []);
      setVideos(d.videos ?? []);
      setProg(d.progressoShows ?? 0);
      setSujo(false);
    } catch {
      notificar('Não foi possível carregar o conteúdo', true);
    } finally {
      setCarr(false);
    }
  }, [notificar]);

  useEffect(() => { carregar(); }, [carregar]);

  /* --- avisar antes de sair com alterações -------------------------------- */

  useEffect(() => {
    if (!sujo) return;
    const aoFechar = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aoFechar);
    return () => window.removeEventListener('beforeunload', aoFechar);
  }, [sujo]);

  /* --- salvar ------------------------------------------------------------- */

  async function salvar() {
    const semTitulo =
      poemas.filter((p) => !p.titulo?.trim()).length +
      videos.filter((v) => !v.titulo?.trim()).length;

    if (semTitulo && !confirm(`${semTitulo} item(ns) sem título. Salvar mesmo assim?`)) return;

    setSalv(true);
    try {
      const r = await fetch('/api/conteudo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poemas, videos, progressoShows: progresso }),
      });

      if (r.status === 401) {
        notificar('Sessão expirada — entre de novo', true);
        setTimeout(aoSair, 1200);
        return;
      }

      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro);

      setPoemas(d.poemas ?? poemas);
      setVideos(d.videos ?? videos);
      setSujo(false);
      notificar('Publicado no site');
    } catch (e) {
      notificar(e.message || 'Falha ao salvar', true);
    } finally {
      setSalv(false);
    }
  }

  async function sair() {
    if (sujo && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    aoSair();
  }

  /* --- operações sobre as listas ------------------------------------------ */

  function alterar(tipo, i, campo, valor) {
    const set = tipo === 'poemas' ? setPoemas : setVideos;
    set((lista) => lista.map((it, k) => (k === i ? { ...it, [campo]: valor } : it)));
    setSujo(true);
  }

  function mover(tipo, i, dir) {
    const set = tipo === 'poemas' ? setPoemas : setVideos;
    set((lista) => {
      const j = i + dir;
      if (j < 0 || j >= lista.length) return lista;
      const nova = [...lista];
      [nova[i], nova[j]] = [nova[j], nova[i]];
      return nova;
    });
    setSujo(true);
  }

  function excluir(tipo, i) {
    const lista = tipo === 'poemas' ? poemas : videos;
    const nome = lista[i]?.titulo || 'este item';
    if (!confirm(`Excluir "${nome}"?`)) return;

    const set = tipo === 'poemas' ? setPoemas : setVideos;
    set((l) => l.filter((_, k) => k !== i));
    setSujo(true);
  }

  function adicionar(tipo) {
    if (tipo === 'poemas') setPoemas((l) => [...l, POEMA_NOVO()]);
    else setVideos((l) => [...l, VIDEO_NOVO()]);
    setSujo(true);
    setAba(tipo);
  }

  /* --- render -------------------------------------------------------------- */

  if (carregando) {
    return <div className="carregando n-hud">Carregando conteúdo...</div>;
  }

  return (
    <div className="panel">

      <header className="abar">
        <div className="abar__left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-neura.webp" alt="Neura" className="abar__logo" />
          <span className="n-hud">Painel de conteúdo</span>
        </div>

        <div className="abar__right">
          <span className={'abar__state n-hud' + (sujo ? ' is-dirty' : '')}>
            {sujo ? 'Alterações não salvas' : 'Tudo publicado'}
          </span>
          <a href="/" target="_blank" rel="noopener noreferrer" className="n-btn n-btn--sm">Ver site</a>
          <button className="n-btn n-btn--sm" onClick={sair}>Sair</button>
          <button
            className="n-btn n-btn--sm n-btn--solid"
            onClick={salvar}
            disabled={salvando || !sujo}
          >
            {salvando ? 'Salvando...' : 'Publicar'}
          </button>
        </div>
      </header>

      <div className="awrap">

        <section className="steps">
          <h1 className="asec__title">Edição ao vivo</h1>
          <p className="steps__note n-mt-4">
            O que você publicar aqui aparece no site imediatamente — não há
            arquivo para baixar nem nada para subir no servidor.
          </p>
        </section>

        {/* progresso dos shows */}
        <section className="asec">
          <div className="asec__head">
            <div>
              <h2 className="asec__title">Shows</h2>
              <p className="asec__hint">
                Controla a barra da seção <em>Shows em breve...</em>
              </p>
            </div>
          </div>

          <div className="slider">
            <input
              className="slider__range"
              type="range"
              min="0"
              max="100"
              value={progresso}
              onChange={(e) => { setProg(Number(e.target.value)); setSujo(true); }}
              aria-label="Progresso da agenda de shows"
            />
            <span className="slider__val">{progresso}%</span>
          </div>
        </section>

        {/* abas */}
        <nav className="tabs" role="tablist">
          <button
            className={'tab' + (aba === 'poemas' ? ' is-active' : '')}
            onClick={() => setAba('poemas')}
            role="tab"
            aria-selected={aba === 'poemas'}
          >
            Poemas <span className="tab__n">{poemas.length}</span>
          </button>
          <button
            className={'tab' + (aba === 'videos' ? ' is-active' : '')}
            onClick={() => setAba('videos')}
            role="tab"
            aria-selected={aba === 'videos'}
          >
            Vídeos <span className="tab__n">{videos.length}</span>
          </button>
        </nav>

        {/* POEMAS */}
        {aba === 'poemas' && (
          <section className="asec" role="tabpanel">
            <div className="asec__head">
              <div>
                <h2 className="asec__title">Poemas</h2>
                <p className="asec__hint">
                  Aparecem no carrossel. A numeração segue a ordem da lista.
                </p>
              </div>
              <button className="n-btn n-btn--sm n-btn--violet" onClick={() => adicionar('poemas')}>
                + Novo poema
              </button>
            </div>

            {poemas.length === 0 ? (
              <p className="empty">Nenhum poema. A seção fica vazia no site.</p>
            ) : (
              <div className="items">
                {poemas.map((p, i) => (
                  <article className="item" key={p.id ?? `novo-${i}`}>
                    <Barra
                      i={i}
                      total={poemas.length}
                      nome={p.titulo}
                      onMover={(d) => mover('poemas', i, d)}
                      onExcluir={() => excluir('poemas', i)}
                    />
                    <div className="item__body">
                      <div>
                        <label className="n-label" htmlFor={`pt${i}`}>Título</label>
                        <input
                          className="n-input"
                          id={`pt${i}`}
                          value={p.titulo ?? ''}
                          maxLength={80}
                          onChange={(e) => alterar('poemas', i, 'titulo', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="n-label" htmlFor={`px${i}`}>Texto</label>
                        <textarea
                          className="n-input"
                          id={`px${i}`}
                          value={p.texto ?? ''}
                          maxLength={2000}
                          onChange={(e) => alterar('poemas', i, 'texto', e.target.value)}
                        />
                        <p className="help">Cada quebra de linha vira uma linha no card.</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* VÍDEOS */}
        {aba === 'videos' && (
          <section className="asec" role="tabpanel">
            <div className="asec__head">
              <div>
                <h2 className="asec__title">Vídeos</h2>
                <p className="asec__hint">
                  Cole o link do YouTube para puxar a capa. Sem link, fica a miniatura genérica.
                </p>
              </div>
              <button className="n-btn n-btn--sm n-btn--violet" onClick={() => adicionar('videos')}>
                + Novo vídeo
              </button>
            </div>

            {videos.length === 0 ? (
              <p className="empty">Nenhum vídeo. A seção fica vazia no site.</p>
            ) : (
              <div className="items">
                {videos.map((v, i) => (
                  <article className="item" key={v.id ?? `novo-${i}`}>
                    <Barra
                      i={i}
                      total={videos.length}
                      nome={v.titulo}
                      onMover={(d) => mover('videos', i, d)}
                      onExcluir={() => excluir('videos', i)}
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
                            onChange={(e) => alterar('videos', i, 'titulo', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="n-label" htmlFor={`vl${i}`}>Legenda</label>
                          <input
                            className="n-input"
                            id={`vl${i}`}
                            value={v.legenda ?? ''}
                            maxLength={60}
                            onChange={(e) => alterar('videos', i, 'legenda', e.target.value)}
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
                          onChange={(e) => alterar('videos', i, 'youtube', e.target.value)}
                        />
                        <PreviaVideo valor={v.youtube} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="asec danger">
          <h2 className="asec__title">Reverter</h2>
          <div className="n-flex n-mt-4">
            <button
              className="n-btn n-btn--sm"
              onClick={() => {
                if (sujo && !confirm('Descartar suas alterações e recarregar o que está publicado?')) return;
                carregar();
                notificar('Recarregado do servidor');
              }}
            >
              Descartar alterações
            </button>
          </div>
          <p className="asec__hint n-mt-4">
            Recarrega o conteúdo publicado, jogando fora o que você editou nesta tela.
          </p>
        </section>

      </div>

      {aviso && (
        <div className={'toast is-on' + (aviso.ruim ? ' is-bad' : '')} role="status">
          {aviso.texto}
        </div>
      )}
    </div>
  );
}


/* ==========================================================================
   AUXILIARES
   ========================================================================== */

function Barra({ i, total, nome, onMover, onExcluir }) {
  return (
    <div className="item__bar">
      <span className="item__num">{String(i + 1).padStart(2, '0')}</span>
      <span className="item__name">{nome || 'sem título'}</span>
      <div className="item__acts">
        <button className="iact" onClick={() => onMover(-1)} disabled={i === 0} aria-label="Mover para cima">▲</button>
        <button className="iact" onClick={() => onMover(1)} disabled={i === total - 1} aria-label="Mover para baixo">▼</button>
        <button className="iact iact--del" onClick={onExcluir} aria-label="Excluir">✕</button>
      </div>
    </div>
  );
}

function PreviaVideo({ valor }) {
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={capaYoutube(id, 'mqdefault')} alt="" />
        <span className="n-hud">Capa do YouTube</span>
      </div>
    </>
  );
}

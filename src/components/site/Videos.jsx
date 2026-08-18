/* eslint-disable @next/next/no-img-element */

import { ytId, capaYoutube, linkYoutube } from '@/lib/youtube';

export default function Videos({ videos = [] }) {
  return (
    <section className="n-section" id="videos">
      <div className="n-container">

        <h2 className="n-title n-reveal">Vídeos</h2>

        <div className="videos n-mt-6">
          {videos.map((v, i) => {
            const id = ytId(v.youtube);
            const externo = Boolean(id);

            return (
              <a
                key={v.id ?? i}
                href={externo ? linkYoutube(id) : '#redes'}
                {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="video n-reveal"
                {...(i > 0 ? { 'data-delay': String(Math.min(i, 4)) } : {})}
              >
                <div className="video__thumb">
                  {externo && (
                    <img
                      className="video__img"
                      src={capaYoutube(id)}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <span className="video__play" aria-hidden="true">▶</span>
                </div>
                <h3 className="video__title">{v.titulo}</h3>
                <p className="n-hud">{v.legenda}</p>
              </a>
            );
          })}
        </div>

      </div>
    </section>
  );
}

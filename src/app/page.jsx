/* ==========================================================================
   Página pública. Componente de servidor: lê o SQLite direto, sem passar
   por fetch, e entrega o HTML já montado (bom para SEO e para quem
   estiver com JavaScript desligado).
   ========================================================================== */

import { lerConteudo } from '@/lib/db';

import Nav              from '@/components/site/Nav';
import Hero             from '@/components/site/Hero';
import Shows            from '@/components/site/Shows';
import Sobre            from '@/components/site/Sobre';
import Poemas           from '@/components/site/Poemas';
import Lore             from '@/components/site/Lore';
import Videos           from '@/components/site/Videos';
import Redes            from '@/components/site/Redes';
import Rodape           from '@/components/site/Rodape';
import AtivarReveal     from '@/components/site/AtivarReveal';
import RegistrarAcesso  from '@/components/site/RegistrarAcesso';

export const dynamic = 'force-dynamic'; // sempre reflete a última edição do painel

export default async function Home() {
  const { poemas, videos, progressoShows, sobre } = await lerConteudo();

  return (
    <>
      <a href="#conteudo" className="n-sr">Pular para o conteúdo</a>

      <Nav />

      <main id="conteudo">
        <Hero />
        <Shows progresso={progressoShows} />
        <Sobre sobre={sobre} />
        <Poemas poemas={poemas} />
        <Lore />
        <Videos videos={videos} />
        <Redes />
      </main>

      <Rodape />
      <AtivarReveal />
      <RegistrarAcesso />
    </>
  );
}

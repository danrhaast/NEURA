import { sessao } from '@/lib/auth';
import { listarUsuarios } from '@/lib/db';
import PainelUsuarios from '@/components/admin/PainelUsuarios';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Usuários — Painel NEURA' };

export default async function Page() {
  const usuario = await sessao();

  // A página roda em paralelo ao layout, então chega aqui mesmo sem login.
  if (!usuario) return null;

  /* O menu já não mostra esta entrada para um editor, mas quem digita a URL
     precisa esbarrar em alguma coisa. A trava que importa está na API — esta
     aqui só evita entregar a lista de contas ao navegador. */
  if (usuario.papel !== 'dono') {
    return (
      <section className="asec">
        <h1 className="phead__titulo">Sem acesso</h1>
        <p className="asec__hint n-mt-4">
          Só contas com papel de dono administram os usuários do painel.
        </p>
      </section>
    );
  }

  return <PainelUsuarios inicial={await listarUsuarios()} euId={usuario.id} />;
}

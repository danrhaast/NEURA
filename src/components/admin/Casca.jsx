'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import Icone from '@/components/admin/Icone';
import { paineisDe, PAPEIS } from '@/lib/papeis';

/* Moldura de todas as telas do painel: menu à esquerda, identificação da conta
   no alto. O menu é montado a partir de src/lib/papeis.js já filtrado pelo
   papel da conta — um editor não vê a entrada de Usuários. Isso é conveniência
   de interface, não a proteção: quem barra o acesso é o servidor. */
export default function Casca({ usuario, children }) {
  const caminho = usePathname();
  const router = useRouter();

  const [aberto, setAberto] = useState(false);
  const paineis = paineisDe(usuario.papel);

  // Fecha o menu ao trocar de tela no celular.
  useEffect(() => { setAberto(false); }, [caminho]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto]);

  async function sair() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.refresh();
  }

  const ativo = (href) =>
    href === '/admin' ? caminho === '/admin' : caminho.startsWith(href);

  return (
    <div className={'casca' + (aberto ? ' is-open' : '')}>

      <aside className="casca__menu">
        <div className="casca__marca">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-neura.webp" alt="Neura" width={92} height={26} />
          <span className="n-hud">Painel</span>
        </div>

        <nav className="casca__nav" aria-label="Seções do painel">
          <Link href="/admin" className={'casca__link' + (ativo('/admin') ? ' is-active' : '')}>
            <Icone nome="painel" />
            <span>Início</span>
          </Link>

          <p className="casca__grupo n-hud">Conteúdo do site</p>

          {paineis.filter((p) => p.id !== 'usuarios').map((p) => (
            <Link key={p.id} href={p.href} className={'casca__link' + (ativo(p.href) ? ' is-active' : '')}>
              <Icone nome={p.icone} />
              <span>{p.nome}</span>
            </Link>
          ))}

          {paineis.some((p) => p.id === 'usuarios') && (
            <>
              <p className="casca__grupo n-hud">Administração</p>
              <Link
                href="/admin/usuarios"
                className={'casca__link' + (ativo('/admin/usuarios') ? ' is-active' : '')}
              >
                <Icone nome="usuarios" />
                <span>Usuários</span>
              </Link>
            </>
          )}
        </nav>

        <div className="casca__rodape">
          <a href="/" target="_blank" rel="noopener noreferrer" className="casca__link">
            <Icone nome="visitas" />
            <span>Ver o site</span>
          </a>
        </div>
      </aside>

      <div className="casca__corpo">
        <header className="casca__topo">
          <button
            className="casca__hamburguer"
            onClick={() => setAberto((v) => !v)}
            aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={aberto}
          >
            <span /><span /><span />
          </button>

          <div className="casca__conta">
            <span className="casca__avatar" aria-hidden="true">
              {(usuario.nome || usuario.usuario).charAt(0).toUpperCase()}
            </span>
            <span className="casca__quem">
              <strong>{usuario.nome || usuario.usuario}</strong>
              <small className="n-hud">{PAPEIS[usuario.papel]?.nome ?? usuario.papel}</small>
            </span>
          </div>

          <button className="n-btn n-btn--sm" onClick={sair}>
            <Icone nome="sair" />
            Sair
          </button>
        </header>

        <main className="casca__tela">{children}</main>
      </div>

      {/* Fundo escuro do menu no celular. */}
      <button
        className="casca__veu"
        onClick={() => setAberto(false)}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

/* eslint-disable @next/next/no-img-element */

export default function Rodape() {
  return (
    <footer className="footer">
      <div className="n-container footer__inner">
        <img src="/assets/logo-neura.webp" alt="Neura" className="footer__logo" />
        <p className="n-hud">
          © {new Date().getFullYear()} Neura — Todos os direitos reservados
        </p>
        <a href="#topo" className="n-hud footer__top">Voltar ao topo ↑</a>
      </div>
    </footer>
  );
}

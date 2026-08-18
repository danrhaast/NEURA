'use client';

import { useState } from 'react';

/** Tela de login. A senha vai para o servidor e é conferida lá. */
export default function Portao({ aoEntrar }) {
  const [senha, setSenha]   = useState('');
  const [erro, setErro]     = useState('');
  const [enviando, setEnv]  = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnv(true);

    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      });

      const dados = await r.json().catch(() => ({}));

      if (r.ok) {
        aoEntrar();
      } else {
        setErro(dados.erro || 'Não foi possível entrar.');
        setSenha('');
      }
    } catch {
      setErro('Servidor fora do ar.');
    } finally {
      setEnv(false);
    }
  }

  return (
    <div className="gate">
      <form className="gate__box" onSubmit={enviar}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-neura.webp" alt="Neura" className="gate__logo" />
        <p className="n-hud gate__label">Painel de conteúdo</p>

        <label className="n-label" htmlFor="senha">Senha</label>
        <input
          className="n-input"
          type="password"
          id="senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />

        <button
          type="submit"
          className="n-btn n-btn--solid n-btn--block n-mt-4"
          disabled={enviando}
        >
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="gate__err" role="alert">{erro}</p>

        <p className="gate__warn">
          A senha é conferida no servidor e nunca trafega de volta para o
          navegador. A sessão dura 8 horas.
        </p>
      </form>
    </div>
  );
}

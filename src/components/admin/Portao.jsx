'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Tela de login. A senha vai para o servidor e é conferida lá. */
export default function Portao() {
  const router = useRouter();

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha]     = useState('');
  const [erro, setErro]       = useState('');
  const [enviando, setEnv]    = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnv(true);

    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha }),
      });

      const dados = await r.json().catch(() => ({}));

      if (r.ok) {
        // Quem decide se o painel aparece é o layout no servidor; recarregar a
        // rota faz ele reavaliar a sessão que o login acabou de abrir.
        router.refresh();
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
        <img src="/assets/logo-neura.webp" alt="Neura" className="gate__logo" width={120} height={34} />
        <p className="n-hud gate__label">Painel de conteúdo</p>

        <label className="n-label" htmlFor="usuario">Usuário</label>
        <input
          className="n-input"
          type="text"
          id="usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
        />

        <label className="n-label n-mt-4" htmlFor="senha">Senha</label>
        <input
          className="n-input"
          type="password"
          id="senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
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

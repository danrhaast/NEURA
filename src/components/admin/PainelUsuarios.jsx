'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Aviso } from '@/components/admin/Cabecalho';
import { PAPEIS } from '@/lib/papeis';

/* Diferente dos painéis de conteúdo, aqui não há rascunho: criar, alterar e
   excluir conta valem na hora. Um "publicar" que segurasse a exclusão de um
   acesso até alguém clicar seria a coisa errada a fazer com credencial. */

const VAZIO = { usuario: '', nome: '', senha: '', papel: 'editor' };

function formatarData(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function PainelUsuarios({ inicial, euId }) {
  const router = useRouter();

  const [usuarios, setUsuarios] = useState(inicial);
  const [form, setForm]         = useState(VAZIO);
  const [criando, setCriando]   = useState(false);
  const [ocupado, setOcupado]   = useState(false);
  const [aviso, setAviso]       = useState(null);

  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const notificar = useCallback((texto, ruim = false) => {
    setAviso({ texto, ruim });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAviso(null), 4000);
  }, []);

  /** Envolve as chamadas à API: trava os botões, trata 401 e mostra o erro. */
  const chamar = useCallback(async (url, opcoes) => {
    setOcupado(true);
    try {
      const r = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opcoes,
      });

      if (r.status === 401) {
        notificar('Sessão expirada — entre de novo', true);
        setTimeout(() => router.refresh(), 1200);
        return null;
      }

      const dados = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(dados.erro || 'A operação falhou.');
      return dados;
    } catch (e) {
      notificar(e.message, true);
      return null;
    } finally {
      setOcupado(false);
    }
  }, [notificar, router]);

  async function recarregar() {
    const d = await chamar('/api/usuarios');
    if (d) setUsuarios(d.usuarios);
    router.refresh();
  }

  async function criar(e) {
    e.preventDefault();

    const d = await chamar('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    if (!d) return;

    setForm(VAZIO);
    setCriando(false);
    setUsuarios((l) => [...l, d.usuario]);
    notificar(`Conta "${d.usuario.usuario}" criada. Entregue a senha a ela.`);
    router.refresh();
  }

  async function trocarPapel(u, papel) {
    const d = await chamar(`/api/usuarios/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ papel }),
    });
    if (!d) return;

    setUsuarios((l) => l.map((x) => (x.id === u.id ? d.usuario : x)));
    notificar(`${u.usuario} agora é ${PAPEIS[papel].nome.toLowerCase()}.`);

    // Rebaixar a própria conta muda o menu: o layout precisa reavaliar.
    if (u.id === euId) router.refresh();
  }

  async function trocarSenha(u) {
    const senha = prompt(`Nova senha para "${u.usuario}":\n\nMínimo de 10 caracteres, misturando letras e números.`);
    if (senha === null) return;

    const d = await chamar(`/api/usuarios/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ senha }),
    });
    if (!d) return;

    notificar(`Senha de "${u.usuario}" trocada.`);
  }

  async function renomear(u) {
    const nome = prompt(`Nome de exibição de "${u.usuario}":`, u.nome || '');
    if (nome === null) return;

    const d = await chamar(`/api/usuarios/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ nome }),
    });
    if (!d) return;

    setUsuarios((l) => l.map((x) => (x.id === u.id ? d.usuario : x)));
    if (u.id === euId) router.refresh();
  }

  async function remover(u) {
    if (!confirm(`Excluir a conta "${u.usuario}"?\n\nEla perde o acesso ao painel imediatamente, inclusive se estiver logada agora.`)) return;

    const d = await chamar(`/api/usuarios/${u.id}`, { method: 'DELETE' });
    if (!d) return;

    setUsuarios((l) => l.filter((x) => x.id !== u.id));
    notificar(`Conta "${u.usuario}" excluída.`);
    router.refresh();
  }

  const donos = usuarios.filter((u) => u.papel === 'dono').length;

  return (
    <>
      <header className="phead phead--simples">
        <div className="phead__texto">
          <h1 className="phead__titulo">Usuários</h1>
          <p className="phead__resumo">
            Contas com acesso a este painel. Não há cadastro público — quem entra
            aqui foi criado por você.
          </p>
        </div>

        <div className="phead__acoes">
          <button className="n-btn n-btn--sm" onClick={recarregar} disabled={ocupado}>
            Recarregar
          </button>
          <button
            className="n-btn n-btn--sm n-btn--solid"
            onClick={() => setCriando((v) => !v)}
            disabled={ocupado}
          >
            {criando ? 'Cancelar' : '+ Nova conta'}
          </button>
        </div>
      </header>

      {criando && (
        <section className="asec">
          <h2 className="asec__titulo">Nova conta</h2>
          <p className="asec__hint">
            A senha não fica recuperável depois — anote e entregue à pessoa. Ela
            pode ser trocada a qualquer momento aqui mesmo.
          </p>

          <form className="form n-mt-5" onSubmit={criar}>
            <div className="field2">
              <div>
                <label className="n-label" htmlFor="novo-usuario">Usuário</label>
                <input
                  className="n-input"
                  id="novo-usuario"
                  value={form.usuario}
                  onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                  placeholder="joao.silva"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
                <p className="help">3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.</p>
              </div>

              <div>
                <label className="n-label" htmlFor="novo-nome">Nome de exibição</label>
                <input
                  className="n-input"
                  id="novo-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="João Silva"
                  maxLength={80}
                />
              </div>
            </div>

            <div className="field2 n-mt-4">
              <div>
                <label className="n-label" htmlFor="nova-senha">Senha inicial</label>
                <input
                  className="n-input"
                  id="nova-senha"
                  type="text"
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  autoComplete="new-password"
                  required
                />
                <p className="help">
                  Mínimo de 10 caracteres, misturando letras e números. Fica visível
                  para você poder copiar.
                </p>
              </div>

              <div>
                <label className="n-label" htmlFor="novo-papel">Papel</label>
                <select
                  className="n-input"
                  id="novo-papel"
                  value={form.papel}
                  onChange={(e) => setForm({ ...form, papel: e.target.value })}
                >
                  {Object.entries(PAPEIS).map(([id, p]) => (
                    <option key={id} value={id}>{p.nome}</option>
                  ))}
                </select>
                <p className="help">{PAPEIS[form.papel]?.descricao}</p>
              </div>
            </div>

            <button className="n-btn n-btn--solid n-mt-5" type="submit" disabled={ocupado}>
              {ocupado ? 'Criando...' : 'Criar conta'}
            </button>
          </form>
        </section>
      )}

      <section className="asec">
        <div className="contas">
          {usuarios.map((u) => {
            const souEu = u.id === euId;
            const ultimoDono = u.papel === 'dono' && donos <= 1;

            return (
              <article className="conta" key={u.id}>
                <span className="conta__avatar" aria-hidden="true">
                  {(u.nome || u.usuario).charAt(0).toUpperCase()}
                </span>

                <div className="conta__quem">
                  <strong>
                    {u.nome || u.usuario}
                    {souEu && <span className="conta__eu n-hud">você</span>}
                  </strong>
                  <span className="conta__login n-hud">{u.usuario}</span>
                </div>

                <div className="conta__meta">
                  <span className={'selo selo--' + u.papel}>{PAPEIS[u.papel]?.nome ?? u.papel}</span>
                  <span className="n-hud">
                    Criada em {formatarData(u.criadoEm)}
                    {' · '}
                    {u.ultimoAcesso ? `último acesso ${formatarData(u.ultimoAcesso)}` : 'nunca entrou'}
                  </span>
                </div>

                <div className="conta__acts">
                  <button className="n-btn n-btn--sm" onClick={() => renomear(u)} disabled={ocupado}>
                    Renomear
                  </button>
                  <button className="n-btn n-btn--sm" onClick={() => trocarSenha(u)} disabled={ocupado}>
                    Trocar senha
                  </button>
                  <button
                    className="n-btn n-btn--sm"
                    onClick={() => trocarPapel(u, u.papel === 'dono' ? 'editor' : 'dono')}
                    disabled={ocupado || ultimoDono}
                    title={ultimoDono ? 'É a única conta dona do painel.' : undefined}
                  >
                    {u.papel === 'dono' ? 'Tornar editor' : 'Tornar dono'}
                  </button>
                  <button
                    className="n-btn n-btn--sm n-btn--perigo"
                    onClick={() => remover(u)}
                    disabled={ocupado || souEu || ultimoDono}
                    title={souEu ? 'Você não pode excluir a própria conta.' : undefined}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <p className="asec__hint n-mt-5">
          Excluir ou rebaixar uma conta vale imediatamente: a sessão dela é
          reconferida contra o banco a cada requisição, sem esperar as 8 horas do
          cookie vencerem.
        </p>
      </section>

      <Aviso aviso={aviso} />
    </>
  );
}

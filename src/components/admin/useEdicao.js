'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Estado compartilhado dos painéis de conteúdo: rascunho, marca de alterações
 * não salvas, publicação e avisos.
 *
 * Os quatro painéis faziam exatamente a mesma dança em volta do
 * `PUT /api/conteudo`; a diferença entre eles é só o pedaço do payload que
 * cada um monta, e é isso que `montarPayload` recebe.
 *
 * @param inicial        valor vindo do servidor (o painel é renderizado com ele já pronto)
 * @param montarPayload  (dados) => corpo parcial do PUT
 */
export function useEdicao(inicial, montarPayload) {
  const router = useRouter();

  const [dados, definirDados] = useState(inicial);
  const [sujo, setSujo]       = useState(false);
  const [salvando, setSalv]   = useState(false);
  const [aviso, setAviso]     = useState(null); // { texto, ruim }

  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const notificar = useCallback((texto, ruim = false) => {
    setAviso({ texto, ruim });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAviso(null), 3200);
  }, []);

  /** Aceita valor ou função, como o setState — e marca o rascunho como sujo. */
  const alterar = useCallback((atualizacao) => {
    definirDados((atual) => (typeof atualizacao === 'function' ? atualizacao(atual) : atualizacao));
    setSujo(true);
  }, []);

  /* Fechar a aba com edição pendente perde o trabalho: o rascunho só existe
     nesta tela até alguém publicar. */
  useEffect(() => {
    if (!sujo) return;
    const aoFechar = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', aoFechar);
    return () => window.removeEventListener('beforeunload', aoFechar);
  }, [sujo]);

  const salvar = useCallback(async () => {
    setSalv(true);
    try {
      const r = await fetch('/api/conteudo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(montarPayload(dados)),
      });

      if (r.status === 401) {
        notificar('Sessão expirada — entre de novo', true);
        setTimeout(() => router.refresh(), 1200);
        return false;
      }

      const resposta = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(resposta.erro);

      setSujo(false);
      notificar('Publicado no site');

      // A home é `force-dynamic`, mas as telas do painel são renderizadas no
      // servidor: sem isto, voltar ao dashboard mostraria os números antigos.
      router.refresh();
      return true;
    } catch (e) {
      notificar(e.message || 'Falha ao salvar', true);
      return false;
    } finally {
      setSalv(false);
    }
  }, [dados, montarPayload, notificar, router]);

  const descartar = useCallback(() => {
    if (sujo && !confirm('Descartar suas alterações e voltar ao que está publicado?')) return;
    definirDados(inicial);
    setSujo(false);
    notificar('Rascunho descartado');
  }, [inicial, sujo, notificar]);

  return { dados, alterar, sujo, salvando, aviso, notificar, salvar, descartar };
}

'use client';

import { useEffect } from 'react';

/**
 * Avisa o servidor que a página foi vista, para alimentar o dashboard do
 * painel. Uma chamada por carregamento, depois que a página já apareceu —
 * nada aqui está no caminho crítico.
 *
 * Quem navega com JavaScript desligado não é contado. É o preço de não
 * registrar a visita durante o render do servidor, que contaria também cada
 * passagem de robô e cada requisição de pré-carregamento.
 */
export default function RegistrarAcesso() {
  useEffect(() => {
    // O React monta o efeito duas vezes em desenvolvimento (StrictMode); sem
    // isto cada carregamento local viraria duas visitas no gráfico.
    if (window.__neuraAcessoRegistrado) return;
    window.__neuraAcessoRegistrado = true;

    const enviar = () =>
      fetch('/api/acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caminho: window.location.pathname,
          referencia: document.referrer || '',
        }),
        keepalive: true,
      }).catch(() => {});

    // Espera o navegador ficar ocioso para não disputar rede com as imagens.
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(enviar, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }

    const t = setTimeout(enviar, 1200);
    return () => clearTimeout(t);
  }, []);

  return null;
}

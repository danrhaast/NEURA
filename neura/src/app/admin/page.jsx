'use client';

import { useEffect, useState } from 'react';
import Portao from '@/components/admin/Portao';
import Editor from '@/components/admin/Editor';

export default function AdminPage() {
  const [sessao, setSessao] = useState(null); // null = ainda verificando

  useEffect(() => {
    fetch('/api/auth/sessao', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setSessao(Boolean(d.autenticado)))
      .catch(() => setSessao(false));
  }, []);

  if (sessao === null) {
    return <div className="carregando n-hud">Verificando sessão...</div>;
  }

  return sessao
    ? <Editor aoSair={() => setSessao(false)} />
    : <Portao aoEntrar={() => setSessao(true)} />;
}

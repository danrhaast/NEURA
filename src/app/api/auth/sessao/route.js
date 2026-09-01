/* GET /api/auth/sessao → { autenticado, usuario, paineis }
   Usado pelo painel para saber quem está logado e o que essa conta enxerga. */

import { sessao } from '@/lib/auth';
import { paineisDe } from '@/lib/papeis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const usuario = await sessao();

  if (!usuario) return Response.json({ autenticado: false, usuario: null, paineis: [] });

  return Response.json({
    autenticado: true,
    usuario,
    paineis: paineisDe(usuario.papel).map((p) => p.id),
  });
}

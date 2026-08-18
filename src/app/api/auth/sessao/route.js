/* GET /api/auth/sessao → { autenticado: boolean }
   Usado pelo painel para saber se já há sessão aberta ao carregar. */

import { autenticado } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ autenticado: await autenticado() });
}

/* POST /api/auth/logout → encerra a sessão */

import { fecharSessao } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  await fecharSessao();
  return Response.json({ ok: true });
}

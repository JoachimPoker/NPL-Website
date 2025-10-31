import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'


export type AdminGate =
| { ok: true; user: any }
| { ok: false; status: 401 | 403; error: 'Unauthorized' | 'Forbidden' }


export async function requireAdmin(): Promise<AdminGate> {
const supabase = createRouteHandlerClient({ cookies })
const { data, error } = await supabase.auth.getUser()
if (error || !data?.user) return { ok: false, status: 401, error: 'Unauthorized' }


const user = data.user
const roles = ((user.app_metadata as any)?.roles ?? []) as string[]
const isAdmin =
roles.includes('admin') || (user.app_metadata as any)?.role === 'admin' || (user.user_metadata as any)?.is_admin === true


if (!isAdmin) return { ok: false, status: 403, error: 'Forbidden' }
return { ok: true, user }
}


export function withAdminAuth<TCtx = any>(
handler: (req: Request, ctx: TCtx, user: any) => Promise<Response>
) {
return async (req: Request, ctx: TCtx) => {
const gate = await requireAdmin()
if (!gate.ok) return new Response(JSON.stringify({ error: gate.error }), { status: gate.status })
return handler(req, ctx, gate.user)
}
}
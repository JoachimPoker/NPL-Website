// src/app/admin/users/page.tsx
import RuledHeading from "@/components/RuledHeading";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isAdminUser } from "@/lib/isAdmin";
import AddAdminForm from "./AddAdminForm";
import { deleteUserAction, removeAdminAction } from "./actions";

export const dynamic = "force-dynamic";

const when = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Never");

export default async function AdminUsersPage() {
  const g = await requireAdmin();
  const me = g.ok ? g.user.id : null;
  let users: { id: string; email?: string; created_at: string; last_sign_in_at?: string | null; app_metadata: Record<string, unknown> }[] = [];
  let loadError: string | null = null;
  try {
    const { data, error } = await createSupabaseAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) loadError = error.message;
    users = (data?.users ?? []) as typeof users;
  } catch (e) {
    loadError = (e as Error).message;
  }
  const admins = users.filter((u) => isAdminUser(u));
  const others = users.filter((u) => !isAdminUser(u));

  const row = (u: (typeof users)[number], admin: boolean) => (
    <li key={u.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-white/[0.07] py-3.5">
      <div className="min-w-0">
        <p className="truncate text-[1.0625rem] font-medium">
          {u.email ?? "(no email)"}
          {u.id === me && <span className="ml-2 text-[0.875rem] font-normal text-season-muted">you</span>}
        </p>
        <p className="text-[0.875rem] text-season-muted">
          Added {when(u.created_at)} · last signed in {when(u.last_sign_in_at)}
        </p>
      </div>
      {u.id !== me && (
        <form action={admin ? removeAdminAction : deleteUserAction}>
          <input type="hidden" name="id" value={u.id} />
          <button className="btn btn-ghost btn-sm">{admin ? "Remove admin access" : "Delete account"}</button>
        </form>
      )}
    </li>
  );

  return (
    <div className="space-y-[clamp(2rem,3.5vw,3rem)] px-4 py-[clamp(1.75rem,3vw,2.75rem)] sm:px-[3.6vw]">
      <div>
        <h1 className="text-[clamp(2rem,3.2vw,3rem)] font-bold leading-[1.04] tracking-[-0.012em]">Users</h1>
        <p className="mt-2 max-w-[52em] text-[1.0625rem] text-season-muted">
          Only admins have accounts; there is no public sign-up. Add a new admin by email, then ask them to open the sign-in page and choose &ldquo;Forgot
          password?&rdquo; to set their password.
        </p>
      </div>

      <section aria-labelledby="add">
        <RuledHeading id="add">Add an admin</RuledHeading>
        <div className="mt-4 max-w-[40rem]">
          <AddAdminForm />
        </div>
      </section>

      {loadError ? (
        <p role="alert" className="rounded-[3px] border border-season-down/50 bg-season-down/[0.08] px-4 py-3 text-[0.9375rem] text-[#ffb3b1]">
          Couldn&apos;t load the accounts: {loadError}. Check that SUPABASE_SERVICE_ROLE_KEY is set on the server.
        </p>
      ) : (
        <>
          <section aria-labelledby="admins">
            <RuledHeading id="admins">Admins ({admins.length})</RuledHeading>
            <ul className="mt-3">{admins.map((u) => row(u, true))}</ul>
          </section>
          {others.length > 0 && (
            <section aria-labelledby="others">
              <RuledHeading id="others">Other accounts ({others.length})</RuledHeading>
              <p className="mt-2 text-[0.9375rem] text-season-muted">
                Accounts without admin access, for example from the old public sign-up. They can&apos;t do anything on the site; you can delete them.
              </p>
              <ul className="mt-3">{others.map((u) => row(u, false))}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

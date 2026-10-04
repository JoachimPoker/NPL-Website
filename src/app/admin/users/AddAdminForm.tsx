"use client";

import { useActionState } from "react";
import { type UserState, addAdminAction } from "./actions";

export default function AddAdminForm() {
  const [state, action, pending] = useActionState<UserState, FormData>(addAdminAction, {});
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="block flex-1">
        <span className="mb-1.5 block text-[0.9375rem] font-medium text-season-ink/85">Email of the new admin</span>
        <input name="email" type="email" required autoComplete="off" className="input input-bordered h-12 w-full" placeholder="name@example.com" />
      </label>
      <button className="btn btn-primary h-12" disabled={pending}>{pending ? "Adding…" : "Add admin"}</button>
      {(state.ok || state.error) && (
        <p role={state.error ? "alert" : "status"} className={`basis-full text-[0.9375rem] ${state.error ? "text-error" : "text-success"}`}>{state.error ?? state.ok}</p>
      )}
    </form>
  );
}

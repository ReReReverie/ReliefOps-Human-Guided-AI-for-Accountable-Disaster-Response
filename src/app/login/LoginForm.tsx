"use client";

import { useActionState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck, TriangleAlert } from "lucide-react";
import { loginAction } from "./actions";

const inputClass =
  "mt-2 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, {});

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-slate-50 px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="relative overflow-hidden bg-slate-950 px-6 py-8 text-white sm:px-10 sm:py-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-700/30 blur-3xl" />
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold">RO</div>
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Coordinator access</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Make the next handoff visible.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">Review synthetic reports, compare AI signals with confirmed facts, and keep human decisions attached to the record.</p>
            <div className="mt-10 space-y-4 border-t border-white/10 pt-6 text-sm text-slate-300">
              <div className="flex items-start gap-3"><ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-300" size={18} /><span>Protected coordinator workspace with auditable actions.</span></div>
              <div className="flex items-start gap-3"><LockKeyhole aria-hidden="true" className="mt-0.5 shrink-0 text-blue-300" size={18} /><span>Use only the credentials configured for this demonstration.</span></div>
            </div>
          </div>
        </aside>

        <section className="px-6 py-8 sm:px-10 sm:py-12">
          <div className="max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">ReliefOps control center</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">Coordinator Login</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Sign in to open the case queue. This prototype contains synthetic data only and is not an emergency service.</p>

            <form action={formAction} className="mt-8 space-y-5" aria-busy={isPending}>
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-800">Email</label>
                <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-800">Password</label>
                <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
              </div>

              {state.error ? (
                <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-5 text-red-800">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
                  <span>{state.error}</span>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {isPending ? "Signing in…" : "Sign in"}
                {!isPending ? <ArrowRight aria-hidden="true" size={17} /> : null}
              </button>
              {isPending ? <p role="status" className="text-center text-xs text-slate-500">Verifying coordinator access…</p> : null}
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

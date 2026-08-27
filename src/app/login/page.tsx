/**
 * /login — Coordinator login page.
 *
 * Local development can explicitly bypass coordinator authentication. In that
 * mode this route immediately redirects to the operator dashboard. Production
 * and normal local development continue to render the login form.
 */
import { redirect } from "next/navigation";
import { isLocalAuthBypassEnabled } from "@/lib/auth/local-config";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  if (isLocalAuthBypassEnabled()) {
    redirect("/ops");
  }

  return <LoginForm />;
}

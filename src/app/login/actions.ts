"use server";
/**
 * src/app/login/actions.ts — Server Action for coordinator login.
 *
 * Uses Neon Auth signIn.email to authenticate the coordinator.
 * On success, the Neon Auth SDK sets the session cookie.
 * Returns { error } on failure — never exposes internal error details.
 */
import { redirect } from "next/navigation";
import { getNeonAuth } from "@/lib/auth/neon";

export async function loginAction(
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const auth = getNeonAuth();
  const { error } = await auth.signIn.email({ email, password });

  if (error) {
    // Return a generic error — never expose internal details
    return { error: "Invalid email or password." };
  }

  // Successful auth — redirect to coordinator queue
  redirect("/ops");
}

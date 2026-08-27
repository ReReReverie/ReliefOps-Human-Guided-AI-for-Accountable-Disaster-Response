"use server";
/**
 * src/app/login/actions.ts — Server Action for coordinator login.
 *
 * LOCAL_DEV=true  → authenticates against LOCAL_COORDINATOR_EMAIL / PASSWORD
 *                   env vars; sets a local HMAC session cookie.
 * Otherwise       → uses Neon Auth signIn.email.
 *
 * Returns { error } on failure — never exposes internal error details.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function loginAction(
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (process.env["LOCAL_DEV"] === "true") {
    const { localSignIn, LOCAL_COORD_COOKIE } = await import(
      "@/lib/auth/local"
    );
    const token = localSignIn(email, password);
    if (!token) {
      return { error: "Invalid email or password." };
    }
    const jar = await cookies();
    jar.set(LOCAL_COORD_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // localhost — no HTTPS required
      maxAge: 12 * 60 * 60, // 12 hours
      path: "/",
    });
    redirect("/ops");
  }

  const { getNeonAuth } = await import("@/lib/auth/neon");
  const auth = getNeonAuth();
  const { error } = await auth.signIn.email({ email, password });

  if (error) {
    return { error: "Invalid email or password." };
  }

  redirect("/ops");
}

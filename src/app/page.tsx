import { redirect } from "next/navigation";

/** `/` redirects to `/report` (Phase 1 placeholder). */
export default function RootPage() {
  redirect("/report");
}

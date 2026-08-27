import { isLocalAuthBypassEnabled } from "@/lib/auth/local-config";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {isLocalAuthBypassEnabled() && (
        <div
          role="status"
          className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900"
        >
          Local development mode: operator authentication is disabled.
        </div>
      )}
      {children}
    </>
  );
}

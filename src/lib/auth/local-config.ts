type LocalAuthEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Authentication may only be bypassed when both explicit local-development
 * switches are enabled. Production remains fail-closed if either is absent.
 */
export function isLocalAuthBypassEnabled(
  environment: LocalAuthEnvironment = process.env
): boolean {
  return (
    environment.LOCAL_DEV === "true" &&
    environment.LOCAL_AUTH_BYPASS === "true"
  );
}

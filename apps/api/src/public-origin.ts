const landingApiMethods: Record<string, string> = {
  "/api/public/config": "GET",
  "/api/public/landing-events": "POST",
  "/api/waitlist": "POST",
};

export function allowedLandingApiMethod(
  origin: string | undefined,
  method: string,
  url: string,
  requestedMethod: string | undefined,
  allowedOrigins: ReadonlySet<string>,
) {
  if (!origin || !allowedOrigins.has(origin)) return undefined;
  const allowedMethod = landingApiMethods[new URL(url, "http://localhost").pathname];
  const actualMethod = method === "OPTIONS" ? requestedMethod : method;
  return actualMethod?.toUpperCase() === allowedMethod ? allowedMethod : undefined;
}

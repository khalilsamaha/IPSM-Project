const SECRET_KEY_PATTERN = /(password|token|secret|service_role|database_url|apikey|api_key|authorization)/i;

function sanitize(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitize(entry)]));
  }
  return value;
}

export function logServerError(scope: string, error: unknown, context?: Record<string, unknown>) {
  console.error(`[server:${scope}]`, { error: sanitize(error), context: sanitize(context) });
}

/**
 * Lightweight tracing wrapper. Logs duration to stdout when AGENT_TRACE=1.
 * Production should swap this for an OpenTelemetry span.
 */
export async function trace<T>(
  name: string,
  context: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    if (process.env.AGENT_TRACE === "1") {
      const duration = Date.now() - start;
      console.log(
        `[TRACE] ${name} ${duration}ms ${JSON.stringify(context)}`
      );
    }
  }
}

type MeasuredRequest<T> =
  | {
      ok: true
      data: T
      latencyMs: number
    }
  | {
      ok: false
      error: unknown
      latencyMs: number
    }

export async function measureRequest<T>(
  request: () => Promise<T>,
): Promise<MeasuredRequest<T>> {
  const startedAt = performance.now()

  try {
    return {
      ok: true,
      data: await request(),
      latencyMs: Math.round(performance.now() - startedAt),
    }
  } catch (error) {
    return {
      ok: false,
      error,
      latencyMs: Math.round(performance.now() - startedAt),
    }
  }
}

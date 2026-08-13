export function formatLatency(latencyMs: number): string {
  if (latencyMs < 1000) {
    return `${latencyMs} 毫秒`
  }

  return `${(latencyMs / 1000).toFixed(1)} 秒`
}

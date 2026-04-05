/** Simulated network / server latency for convincing demo UX */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Random delay in [min, max] ms */
export async function jitterDelay(min = 280, max = 720): Promise<void> {
  const ms = min + Math.floor(Math.random() * (max - min));
  await delay(ms);
}

/** Occasionally reject to demo error states (use sparingly) */
export async function maybeFail<T>(fn: () => Promise<T>, failProbability = 0): Promise<T> {
  if (failProbability > 0 && Math.random() < failProbability) {
    throw new Error("Error simulado de red. Vuelve a intentar.");
  }
  return fn();
}

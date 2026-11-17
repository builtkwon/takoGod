/** mulberry32. 같은 시드는 같은 수열을 낸다. 반환값은 [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0..n-1 정수. */
export const randomIndex = (n: number, rng: () => number): number => Math.floor(rng() * n);

/** Fisher–Yates. 원본은 바꾸지 않는다. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, rng);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

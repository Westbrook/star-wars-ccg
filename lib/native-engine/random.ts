/** Server-only entropy. Persist shuffled cards, never a client-visible RNG seed. */
export type Entropy = () => number;

export const secureEntropy: Entropy = () => crypto.getRandomValues(new Uint32Array(1))[0];

export function shuffled<T>(cards: readonly T[], entropy: Entropy = secureEntropy): T[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const bound = i + 1;
    const limit = 0x100000000 - 0x100000000 % bound;
    let value: number;
    let attempts = 0;
    do {
      value = entropy();
      if (!Number.isSafeInteger(value) || value < 0 || value >= 0x100000000)
        throw Error('Invalid shuffle entropy.');
      // A broken entropy source must fail the command, not hang a Worker.
      if (++attempts > 128) throw Error('Shuffle entropy failed to converge.');
    } while (value >= limit);
    const j = value % bound;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

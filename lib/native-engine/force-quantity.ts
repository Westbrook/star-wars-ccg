/** AR p30 (Rounding), pp138–139 (Brainiac): retain numeric values for
 * comparisons, but round when an effect requires an indivisible card movement.
 * Explicit card-text rounding must be applied by its provider first. */
export const validForceQuantity = (amount: number): boolean => typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= Number.MAX_SAFE_INTEGER;
export function wholeForce(amount: number): number {
  if (!validForceQuantity(amount)) throw Error('Invalid Force quantity.');
  return Math.round(amount);
}

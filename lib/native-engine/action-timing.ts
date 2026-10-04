import type {Window} from './types';

/** General optional actions alternate during either kind of weapon segment.
 * Battle-specific eligibility must still be checked by its own provider. */
export function optionalActionWindow(w: Window): boolean {
  return w.timing === 'phase' || w.timing === 'response' &&
    ['battle-weapons', 'attack-weapons'].includes((w.event as {kind?: string})?.kind ?? '');
}

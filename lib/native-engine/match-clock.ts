import {sides, type Side} from './types';

/** Optional online time control, separate from card rules. Setup is untimed.
 * Persist the anchor, not a ticking counter; reads must never restart a clock. */
export type MatchClock = {minutes: number; remaining: Record<Side, number>; running: Side | null; since: number};
export const clockMinutes = [15, 30, 45, 60] as const;
export const validClockMinutes = (n: unknown): n is number => typeof n === 'number' && (clockMinutes as readonly number[]).includes(n);
const timestamp = (n: number) => {if (!Number.isSafeInteger(n) || n < 0) throw Error('Invalid match clock time.');};
export function createClock(minutes: number, now: number): MatchClock {
  if (!validClockMinutes(minutes)) throw Error('Invalid match time control.');
  timestamp(now);
  return {minutes, remaining: {dark: minutes * 60000, light: minutes * 60000}, running: null, since: now};
}
export function assertClock(clock: MatchClock): void {
  if (!clock || !validClockMinutes(clock.minutes) || !clock.remaining ||
      clock.running !== null && !sides.includes(clock.running) ||
      sides.some(s => !Number.isSafeInteger(clock.remaining[s]) || clock.remaining[s] < 0 || clock.remaining[s] > clock.minutes * 60000))
    throw Error('Invalid saved match clock.');
  timestamp(clock.since);
}
export function projectClock(clock: MatchClock, now: number) {
  assertClock(clock); timestamp(now);
  const remainingMs = {...clock.remaining};
  if (clock.running) remainingMs[clock.running] = Math.max(0, remainingMs[clock.running] - Math.max(0, now - clock.since));
  return {minutes: clock.minutes, remainingMs, running: clock.running};
}
/** Consume elapsed time once, on the same successful transaction as the move.
 * A backwards server clock cannot refund time or move the anchor backwards. */
export function moveClock(clock: MatchClock, running: Side | null, now: number): MatchClock {
  if (running !== null && !sides.includes(running)) throw Error('Invalid clock owner.');
  return {...clock, remaining: projectClock(clock,now).remainingMs, running, since: Math.max(now,clock.since)};
}
export function expiredClock(clock: MatchClock, now: number): Side | null {
  return clock.running && projectClock(clock,now).remainingMs[clock.running] === 0 ? clock.running : null;
}

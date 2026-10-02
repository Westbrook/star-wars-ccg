import type {Json, Match} from './types';
import {cardVersion} from './identity';
export type EquipmentState = {
  turn: number;
  devices: Record<string, string>;
  deviceVersions?: Record<string, number>;
  training: Record<string, 'warrior' | 'power'>;
  mines: Record<string, number>;
};
export function equipmentState(m: Match): EquipmentState {
  const s = m.data.equipment as EquipmentState | undefined;
  return {turn: m.turn.number, devices: s?.turn === m.turn.number ? s.devices : {}, deviceVersions: s?.turn === m.turn.number ? s.deviceVersions ?? {} : {}, training: s?.training ?? {}, mines: s?.mines ?? {}};
}
export function recordEquipment(m: Match): EquipmentState {
  const s = equipmentState(m); m.data.equipment = s as unknown as Json; return s;
}
export function canUseDevice(m: Match, id: string): boolean {
  const c = m.cards[id], host = c?.attachedTo;
  const s = equipmentState(m);
  return !!host && c.zone === 'table' && m.cards[host].zone === 'table' && (!s.devices[host] || s.devices[host] === id && (s.deviceVersions?.[host] ?? 0) === cardVersion(m, id));
}
export function useDevice(m: Match, id: string): void {
  if (!canUseDevice(m, id)) throw Error('A character may use only one different device each turn.');
  const s = recordEquipment(m), host = m.cards[id].attachedTo!;
  s.devices[host] = id; (s.deviceVersions ??= {})[host] = cardVersion(m, id);
}
/** Condition producers will add/remove affected site IDs when their rules enter
 * the catalog. No existing starter creates nighttime conditions. */
export const nighttimeSites = (m: Match): string[] => (m.data.nighttimeSites as string[] | undefined) ?? [];

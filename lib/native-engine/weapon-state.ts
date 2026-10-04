import {premiereSystems} from './premiere-setup';
import identities from '../../data/native-engine/identities.json';
import {cardDefinition} from './board';
import type {Json, Match} from './types';
import {cardVersion} from './identity';
export type WeaponUse = {turn: number; users: Record<string, string[]>; versions?: Record<string, number[]>};
const useState = (m: Match): WeaponUse => {const s = m.data.weaponUse as WeaponUse | undefined; return s?.turn === m.turn.number ? s : {turn: m.turn.number, users: {}};};
/** AR pp79/94: one different weapon each turn; extra printed warrior icons
 * allow that many different weapons, but not repeated use of the same one. */
export function canUseWeapon(m: Match, id: string, user?: string): boolean {
  const weapon = m.cards[id], host = user ?? weapon?.attachedTo;
  if (!host || weapon.zone !== 'table' || m.cards[host]?.zone !== 'table') return false;
  const b = m.data.battle as {stage: string; knockedWeapons?: string[]} | undefined;
  if (b && b.stage !== 'complete' && b.knockedWeapons?.includes(id)) return false;
  const used = useState(m).users[host] ?? [];
  const versions = useState(m).versions?.[host];
  const repeated = used.some((card, i) => card === id && (versions?.[i] ?? 0) === cardVersion(m, id));
  const def = cardDefinition(m, host);
  if (def.type === 'Starship' && def.subType.startsWith('Capital:')) return true;
  if (def.type === 'Starship' && def.subType.startsWith('Squadron:')) return used.length < 3 || repeated;
  const icons = def.icons.filter(icon => icon === 'Warrior').length;
  return icons > 1 ? used.length < icons && !repeated : !used.length || repeated;
}
export function useWeapon(m: Match, id: string, user?: string): void {
  if (!canUseWeapon(m, id, user)) throw Error('Weapon use is restricted for this card.');
  const s = useState(m), host = user ?? m.cards[id].attachedTo!;
  const ids = s.users[host] ??= [], versions = (s.versions ??= {})[host] ??= ids.map(() => 0);
  if (!ids.some((card, i) => card === id && versions[i] === cardVersion(m, id))) {ids.push(id); versions.push(cardVersion(m, id));}
  m.data.weaponUse = s as unknown as Json;
}
export function assertWeaponUse(m: Match): void {
  const s = m.data.weaponUse as WeaponUse | undefined;
  if (!s) return;
  if (!Number.isSafeInteger(s.turn) || s.turn < 1 || s.turn > m.turn.number || !s.users || typeof s.users !== 'object' || Array.isArray(s.users)) throw Error('Invalid weapon-use history.');
  if (s.versions && (typeof s.versions !== 'object' || Array.isArray(s.versions) || Object.keys(s.versions).some(host => !s.users[host]))) throw Error('Invalid weapon instance history.');
  for (const [host, weapons] of Object.entries(s.users)) {
    const versions = s.versions?.[host];
    if (!m.cards[host] || (!['Character','Vehicle','Starship'].includes(cardDefinition(m, host).type)&&!premiereSystems[m.cards[host].blueprint]?.mobile) || !Array.isArray(weapons) || !weapons.length || weapons.some(id => !m.cards[id] || cardDefinition(m, id).type !== 'Weapon') || versions && (!Array.isArray(versions) || versions.length !== weapons.length || versions.some((v, i) => !Number.isSafeInteger(v) || v < 0 || v > cardVersion(m, weapons[i]))) || new Set(weapons.map((id, i) => id + ':' + (versions?.[i] ?? 0))).size !== weapons.length) throw Error('Invalid weapon-use record.');
  }
}

export const armedWithLightsaber = (m: Match, id: string): boolean => m.cards[id]?.zone==='table' && Object.values(m.cards).some(c=>c.zone==='table' && c.attachedTo===id && (identities as Record<string,{keywords:string[]}>)[c.blueprint]?.keywords.includes('LIGHTSABER'));

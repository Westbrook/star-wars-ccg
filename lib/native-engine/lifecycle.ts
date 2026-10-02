import type {Match} from './types';
import type {GroundState} from './ground';
import type {EquipmentState} from './equipment-state';
import type {WeaponUse} from './weapon-state';
import type {Battle} from './battle';

/** Only card-instance state expires here. Title limits, completed loss credit,
 * and resolved effects with their own duration must survive their source. */
export function leaveTable(m: Match, id: string): void {
  const ground = m.data.ground as GroundState | undefined;
  if (ground) {ground.moved = ground.moved.filter(card => card !== id); delete ground.barriers[id];}
  const equipment = m.data.equipment as EquipmentState | undefined;
  if (equipment) {delete equipment.devices[id]; delete equipment.deviceVersions?.[id]; delete equipment.training[id]; delete equipment.mines[id];}
  const weapons = m.data.weaponUse as WeaponUse | undefined;
  if (weapons) {delete weapons.users[id]; delete weapons.versions?.[id];}
  const history = m.data.battles as {participants: string[]} | undefined;
  if (history) history.participants = history.participants.filter(card => card !== id);
  const battle = m.data.battle as Battle | undefined;
  if (battle && battle.stage !== 'complete') {
    // Preserve the current battle's departed participants (including Old Ben),
    // even if departure and return occur within a single rules continuation.
    if (Object.values(battle.participants).some(cards => cards.includes(id))) {
      const departed = battle.departed ??= []; if (!departed.includes(id)) departed.push(id);
    }
    battle.hits = battle.hits.filter(card => card !== id);
    battle.fired = battle.fired.filter(card => card !== id);
    if (battle.knockedWeapons) battle.knockedWeapons = battle.knockedWeapons.filter(card => card !== id);
  }
}

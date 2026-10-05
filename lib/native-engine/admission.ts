import type {Deck, Match, Side} from './types';

export type CardCounts = Readonly<Record<string, number>>;
/** Profiles certify an exact pair, not the individual cards in arbitrary decks. */
export type AdmissionProfile = Readonly<{
  id: string; rulesVersion: string; evidenceVersion: string; enabled: boolean;
  format: 'open'; deckSize: 60; decks: Readonly<Record<Side, CardCounts>>;
}>;
export type AdmissionStamp = {
  schema: 1; profileId: string; rulesVersion: string; evidenceVersion: string;
  format: 'open'; deckSize: 60; decks: Record<Side, Record<string, number>>;
};
export type AdmissionRules = {id: string; supports(blueprint: string): boolean; admissionProfiles?: readonly AdmissionProfile[]};
export type AdmissionFormat = 'open' | 'otsd';
const sides: readonly Side[] = ['dark','light'];
const token = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function countsValid(v: unknown): v is CardCounts {
  return record(v) && Object.keys(v).length > 0 && Object.entries(v).every(([bp,n]) => /^\d+_\d+$/.test(bp) && bp.length <= 40 && Number.isSafeInteger(n) && Number(n) > 0) && Object.values(v).reduce<number>((n,v) => n + Number(v),0) === 60;
}
export function deckCounts(cards: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const bp of cards) counts[bp] = (counts[bp] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a],[b]) => a.localeCompare(b)));
}
const sameCounts = (a: CardCounts,b: CardCounts) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([bp,n]) => b[bp] === n);
function validProfile(p: AdmissionProfile) {
  return record(p) && token(p.id) && token(p.rulesVersion) && token(p.evidenceVersion) && typeof p.enabled === 'boolean' && p.format === 'open' && p.deckSize === 60 && record(p.decks) && Object.keys(p.decks).length === 2 && sides.every(s => countsValid(p.decks[s]));
}
/** Copy and freeze configuration so a caller's mutable catalog cannot authorize decks. */
export function defineAdmissionProfiles(profiles: readonly AdmissionProfile[]): readonly AdmissionProfile[] {
  const ids = new Set<string>();
  return Object.freeze(profiles.map(p => {
    if (!validProfile(p) || ids.has(p.id)) throw Error('Invalid exact-pair admission profile.');
    ids.add(p.id);
    return Object.freeze({...p,decks:Object.freeze({dark:Object.freeze({...p.decks.dark}),light:Object.freeze({...p.decks.light})})});
  }));
}
/** No production deck profile is enabled by default. */
export const noAdmissionProfiles = defineAdmissionProfiles([]);
function profiles(rules: AdmissionRules): readonly AdmissionProfile[] {
  const list = rules.admissionProfiles ?? noAdmissionProfiles, ids = new Set<string>();
  for (const p of list) {
    if (!validProfile(p) || p.rulesVersion !== rules.id || ids.has(p.id)) throw Error('Invalid rules admission configuration.');
    ids.add(p.id);
  }
  return list;
}
function stamp(p: AdmissionProfile): AdmissionStamp {
  return {schema:1,profileId:p.id,rulesVersion:p.rulesVersion,evidenceVersion:p.evidenceVersion,format:'open',deckSize:60,decks:{dark:{...p.decks.dark},light:{...p.decks.light}}};
}
export const globallySupportedDeck = (rules: AdmissionRules, deck: Deck) => deck.cards.every(bp => rules.supports(bp));
export function admissionCandidates(rules: AdmissionRules, deck: Deck, size: number, format: AdmissionFormat = 'open'): AdmissionStamp[] {
  const list = profiles(rules);
  if (format !== 'open' || size !== 60 || deck.cards.length !== 60 || !sides.includes(deck.side)) return [];
  const counts = deckCounts(deck.cards);
  return list.filter(p => p.enabled && sameCounts(p.decks[deck.side],counts)).sort((a,b) => a.id.localeCompare(b.id)).map(stamp);
}
export function admitsDeck(rules: AdmissionRules, deck: Deck, size: number, format: AdmissionFormat = 'open'): boolean {
  return globallySupportedDeck(rules,deck) || admissionCandidates(rules,deck,size,format).length > 0;
}
export function pairAdmission(rules: AdmissionRules, decks: readonly Deck[], size: number, format: AdmissionFormat = 'open'): AdmissionStamp | undefined {
  if (decks.length !== 2 || new Set(decks.map(d => d.side)).size !== 2 || decks.some(d => !sides.includes(d.side))) throw Error('Invalid admission: specify one deck for each side.');
  if (decks.some(d => d.cards.length !== size)) throw Error('Invalid deck size.');
  if (decks.every(d => globallySupportedDeck(rules,d))) return;
  const dark = decks.find(d => d.side === 'dark')!, light = decks.find(d => d.side === 'light')!;
  const selected = admissionCandidates(rules,dark,size,format).find(p => sameCounts(p.decks.light,deckCounts(light.cards)));
  if (!selected) throw Error('Unimplemented card behavior: no verified exact-pair admission.');
  return selected;
}
export function assertAdmissionStamp(rules: AdmissionRules, value: unknown): asserts value is AdmissionStamp {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'deckSize,decks,evidenceVersion,format,profileId,rulesVersion,schema' || value.schema !== 1 || value.rulesVersion !== rules.id || value.format !== 'open' || value.deckSize !== 60 || !record(value.decks) || Object.keys(value.decks).length !== 2 || !sides.every(s => countsValid((value.decks as Record<string,unknown>)[s]))) throw Error('Invalid saved admission snapshot.');
  const p = profiles(rules).find(p => p.id === value.profileId);
  if (!p?.enabled || p.evidenceVersion !== value.evidenceVersion || !sides.every(s => sameCounts(p.decks[s],(value.decks as Record<Side,CardCounts>)[s]))) throw Error('Saved match needs its original admission profile.');
}
export function assertAdmissionCandidates(rules: AdmissionRules, value: unknown, deck: Deck, size: number): asserts value is AdmissionStamp[] {
  if (!Array.isArray(value) || !value.length || size !== 60 || deck.cards.length !== 60) throw Error('Invalid waiting admission snapshot.');
  const ids = new Set<string>(), counts = deckCounts(deck.cards);
  for (const candidate of value) {
    assertAdmissionStamp(rules,candidate);
    if (ids.has(candidate.profileId) || !sameCounts(candidate.decks[deck.side],counts)) throw Error('Waiting deck differs from its admission snapshot.');
    ids.add(candidate.profileId);
  }
}
/** Recovery checks the original physical decks, including stolen cards. */
export function assertMatchAdmission(m: Match, rules: AdmissionRules): void {
  const value = m.data.nativeAdmission;
  if (value === undefined) {
    if (Object.values(m.cards).some(c => !rules.supports(c.blueprint))) throw Error('Missing verified match admission.');
    return;
  }
  assertAdmissionStamp(rules,value);
  if (m.rules !== value.rulesVersion || m.deckSize !== value.deckSize) throw Error('Saved admission format mismatch.');
  for (const side of sides) {
    const cards = Object.values(m.cards).filter(c => (c.originalOwner ?? c.owner) === side).map(c => c.blueprint);
    if (!sameCounts(value.decks[side],deckCounts(cards))) throw Error('Saved cards differ from admitted original decks.');
  }
}

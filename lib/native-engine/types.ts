export type Side = 'dark' | 'light';
export const sides: readonly Side[] = ['dark', 'light'];
export const other = (side: Side): Side => side === 'dark' ? 'light' : 'dark';
export const piles = ['reserve', 'force', 'used', 'lost', 'hand', 'destiny'] as const;
export type Pile = typeof piles[number];
export type Zone = Pile | 'table' | 'playing' | 'leaving' | 'buried' | 'stacked' | 'out';
export type Json = null | boolean | number | string | Json[] | {[key: string]: Json};
export type Card = {
  id: string;
  blueprint: string;
  owner: Side;
  zone: Zone;
  location?: string;
  attachedTo?: string;
  coveredBy?: string;
  /** Inactive, face-up card on an Effect; distinct from an active attachment. */
  stackedOn?: string;
};
export type Player = Record<Pile, string[]>;
export type Phase = 'activate' | 'control' | 'deploy' | 'battle' | 'move' | 'draw';
export type Timing = 'start' | 'phase' | 'end' | 'response';
export type Payment = Partial<Record<Side, number>>;
/** Handler keys and JSON payloads survive process restarts; closures never enter state. */
export type Action = {
  id: string;
  label: string;
  handler: string;
  payload: Json;
  payment?: Payment;
  /** Card text may prohibit responses to its result, while costs still respond. */
  unrespondable?: true;
  source?: string;
};
export type Window = {
  kind: 'window';
  serial: number;
  timing: Timing;
  priority: Side;
  passes: number;
  completed: string[];
  event?: Json;
};
export type Resolution = {
  kind: 'resolution';
  awaitingResponses?: boolean;
  actor: Side;
  action: Action;
  cancelled: boolean;
};
export type Decision = {kind: 'decision'; side: Side; handler: string; payload: Json};
export type Frame = Window | Resolution | Decision;
export type StartingLocation = {identity: string; group: string; icons: Record<Side, number>; convertible: boolean};
export type Setup = {
  stage: 'choose' | 'reveal' | 'conversion' | 'placement' | 'shuffle' | 'complete';
  selected: Record<Side, string | null>;
  committed: Record<Side, boolean>;
  revealed: boolean;
  rejected: string[][];
  priority: Side;
  covered: string | null;
};
export type Match = {
  schema: 1;
  engine: 'native-engine-1';
  rules: string;
  id: string;
  revision: number;
  deckSize: 40 | 60;
  status: 'setup' | 'playing' | 'finished';
  cards: Record<string, Card>;
  players: Record<Side, Player>;
  locations: string[];
  turn: {number: number; side: Side; phase: Phase; generation: number; activated: number};
  stack: Frame[];
  serial: number;
  // Rule-owned serialized continuations, restrictions, per-turn usage and effects.
  data: Record<string, Json>;
  setup?: Setup;
  result: null | {winner: Side; loser: Side; reason: 'concession' | 'life-force' | 'timeout'};
};
export type Deck = {side: Side; cards: readonly string[]};
export type Definition = {side: Side; name: string};
export type Command = {revision: number; choice: string};
export type Prompt = {revision: number; side: Side; timing: Timing | 'decision' | 'setup'; mandatory: boolean; choices: {id: string; label: string; card?: string; forceIcons?: Record<Side, number>}[]};

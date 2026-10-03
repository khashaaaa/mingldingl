import type { ComponentType } from 'react';
import type { RoomName } from '../../../lib/world';
import { useWorld } from '../../world/WorldProvider';
import { Anvil } from './Anvil';
import { Bonfire } from './Bonfire';
import { IceShards } from './IceShards';
import { Mill } from './Mill';
import { Swords } from './Swords';
import { Wyrm } from './Wyrm';
import type { SceneProps } from './shared';

export { SCENE_W, type SceneProps } from './shared';

export type SceneName = 'bonfire' | 'anvil' | 'swords' | 'mill' | 'ice' | 'wyrm';

export const SCENES: Record<SceneName, ComponentType<SceneProps>> = {
  bonfire: Bonfire,
  anvil: Anvil,
  swords: Swords,
  mill: Mill,
  ice: IceShards,
  wyrm: Wyrm,
};

/**
 * Which scene each room of the hold paints while it waits — a table like `ROOMS` itself, so a
 * screen never picks its own: the hearth keeps its fire, the forge works a bar, the hall's
 * blades meet, the tavern's mill grinds, the gate is held by ice, and something lives in the deep.
 */
export const ROOM_SCENES: Record<RoomName, SceneName> = {
  hearth: 'bonfire',
  forge: 'anvil',
  hall: 'swords',
  tavern: 'mill',
  road: 'mill',
  gate: 'ice',
  deep: 'wyrm',
};

/** The scene for the room on screen; the bonfire where there is no room (unlit, or no world). */
export function useRoomScene(): SceneName {
  const room = useWorld()?.room;
  return room ? ROOM_SCENES[room] : 'bonfire';
}

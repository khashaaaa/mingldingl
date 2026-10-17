import type { ArtName } from '@/design/art/manifest';
import type { StringKey } from '@/lib/i18n';

/** Each honour's emblem (Figma "Art — Honours & feats"); the engine owns when it is earned. */
const EMBLEM: Record<string, ArtName> = {
  sealBreaker: 'honour_seal_breaker',
  flamekeeper: 'honour_flamekeeper',
  sevenDawns: 'honour_seven_dawns',
  allyCaller: 'honour_ally_caller',
  trueToWord: 'honour_true_to_word',
  threadWeaver: 'honour_thread_weaver',
  mended: 'honour_mended',
  cartographer: 'honour_cartographer',
  bondKeeper: 'honour_bond_keeper',
  oathKeeper: 'honour_oath_keeper',
  fateSeer: 'honour_fate_seer',
  hearthbound: 'honour_hearthbound',
  naadam: 'honour_naadam',
  tsagaanSar: 'honour_tsagaan_sar',
  firstBond: 'honour_first_bond',
  iceBroken: 'honour_ice_broken',
  firstTrial: 'honour_first_trial',
  tenWords: 'honour_ten_words',
  firstPledge: 'honour_first_pledge',
  faceToFlame: 'honour_face_to_flame',
  oathFulfilled: 'honour_oath_fulfilled',
};

export const emblem = (key: string): ArtName => EMBLEM[key] ?? 'honour_locked';

/** name / did (the ceremony) / for (the detail) / line (its saying). */
export const honourText = (key: string, part: 'name' | 'did' | 'for' | 'line'): StringKey =>
  (key in EMBLEM ? `honour.${key}.${part}` : `honour.sealBreaker.${part}`) as StringKey;

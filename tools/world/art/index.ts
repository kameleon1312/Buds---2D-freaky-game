import { CITY } from './city';
import { COMMON } from './common';
import type { Prop } from './kit';
import { MANOR } from './manor';
import { RUINS } from './ruins';
import { TROPIC } from './tropic';

/** Every prop the game can show, by name (the name is what map legends refer to). */
export const ALL_PROPS: Record<string, Prop> = {
  ...COMMON,
  ...CITY,
  ...TROPIC,
  ...MANOR,
  ...RUINS,
};

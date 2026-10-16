import { CITY } from './city';
import { COMMON } from './common';
import { INTERIOR } from './interior';
import type { Prop } from './kit';
import { MANOR } from './manor';
import { PLACES } from './places';
import { QUEST_PROPS } from './quest';
import { RIDE_PROPS, TRAINING_PROPS } from './rides';
import { RUINS } from './ruins';
import { TROPIC } from './tropic';

/** Every prop the game can show, by name (the name is what map legends refer to). */
export const ALL_PROPS: Record<string, Prop> = {
  ...COMMON,
  ...CITY,
  ...TROPIC,
  ...MANOR,
  ...RUINS,
  ...QUEST_PROPS,
  ...INTERIOR,
  ...RIDE_PROPS,
  ...TRAINING_PROPS,
  ...PLACES,
};

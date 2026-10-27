/** Blinking lights cycle in two groups across this many palette phases. */
export const LIGHT_PHASES = 4;
/** Seconds per light phase. */
export const LIGHT_STEP = 0.4;
// Which of the two light groups is lit at each phase.
const LIGHT_CYCLE: readonly (readonly [boolean, boolean])[] = [
  [true, false],
  [false, false],
  [false, true],
  [false, false],
];

/** [group A lit, group B lit] for a phase; any integer phase wraps. */
export function lightCycle(phase: number): readonly [boolean, boolean] {
  return LIGHT_CYCLE[((phase % LIGHT_PHASES) + LIGHT_PHASES) % LIGHT_PHASES]!;
}

/** Bitmap indices of the two light groups in every set piece that has lights. */
export const LIGHT_A = 4;
export const LIGHT_B = 5;

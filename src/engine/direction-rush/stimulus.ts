import { type RushDirection, type RushStimulus, RUSH_DIRECTIONS } from './types';

/** Generate a stimulus with independent pointing + moving. No predictable pairing. */
export function generateStimulus(): RushStimulus {
  const pointing = RUSH_DIRECTIONS[Math.floor(Math.random() * RUSH_DIRECTIONS.length)];
  const moving = RUSH_DIRECTIONS[Math.floor(Math.random() * RUSH_DIRECTIONS.length)];
  // Avoid perfectly identical as a slight visual nudge, but allow it.
  return { pointing, moving };
}

/** Leaf SVG paths — one shape reusable for all leaves. */
export const LEAF_PATH = `
  M12 2
  C5.86 2 2 5.86 2 12
  C2 18.14 5.86 22 12 22
  C18.14 22 22 18.14 22 12
  C22 5.86 18.14 2 12 2
  Z
`;

/** Leaf visual metadata. */
export interface LeafMeta {
  /** CSS transform: rotate(angledeg) translateX(x) translateY(y) */
  rotate: number; // direction the tip points (same as stimulus.pointing)
  /** Travel direction (independent). */
  move: RushDirection;
  /** How far to translate each rAF frame (pixels per frame). */
  speed: number;
  /** Starting position side: 'top' | 'bottom' | 'left' | 'right' | 'center'. */
  spawnSide: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** How far from the edge to start (pixels inward). */
  offset: number;
}

/** Compute leaf parameters from a stimulus + viewport size. */
export function computeLeaves(
  stimulus: RushStimulus,
  width: number,
  height: number,
  count: number,
): LeafMeta[] {
  const result: LeafMeta[] = [];

  // Distribute count roughly evenly across 4 sides, remainder center
  const perSide = Math.floor(count / 4);
  const remainder = count - perSide * 4;

  // Helper to add a leaf
  const addLeaf = (side: string, offsetPx: number, speedMult: number) => {
    const speed = 2 + Math.random() * 3; // 2–5 px/frame
    result.push({
      rotate: stimulus.pointing === 'up' ? 0 : stimulus.pointing === 'down' ? 180 : stimulus.pointing === 'left' ? 270 : 90,
      move: stimulus.moving,
      speed: speed * speedMult,
      spawnSide: side as any,
      offset: offsetPx,
    });
  };

  // Top side leaves entering downwards
  for (let i = 0; i < perSide; i++) addLeaf('top', 40 + i * (width / (perSide + 1)), 1);
  // Bottom side leaves entering upwards
  for (let i = 0; i < perSide; i++) addLeaf('bottom', height - 40 - i * (height / (perSide + 1)), 1);
  // Left side leaves entering rightwards
  for (let i = 0; i < perSide; i++) addLeaf('left', 40 + i * (height / (perSide + 1)), 1);
  // Right side leaves entering leftwards
  for (let i = 0; i < perSide; i++) addLeaf('right', width - 40 - i * (height / (perSide + 1)), 1);

  // Remainder in center with random spawn
  for (let i = 0; i < remainder; i++) {
    const side = ['top', 'bottom', 'left', 'right'][i % 4];
    const offset = 40 + Math.random() * (side === 'top' || side === 'bottom' ? width : height);
    addLeaf(side, offset, 0.8 + Math.random() * 0.4);
  }

  return result;
}

/** Map a RushDirection to a CSS rotate value (degrees). */
export function directionToRotate(dir: RushDirection): number {
  return dir === 'up' ? 0 : dir === 'down' ? 180 : dir === 'left' ? 270 : 90;
}
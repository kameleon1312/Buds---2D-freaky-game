import { Resvg } from '@resvg/resvg-js';
import { VIEW_H, VIEW_W, budSheetSvg, type BudLook } from '@buds/shared';

/** Logical sheet cell is 16×24 "units"; scale 8 → 128×192 px per frame. */
export const SHEET_UNIT_W = 16;
export const SHEET_UNIT_H = 24;

/**
 * Sprite sheet consumed by the Unity client (vector art rasterised server-side).
 * Layout (top-left origin): columns = walk frames 0,1,2; rows = down, side (faces left), up.
 */
export function budSheetPng(look: BudLook, scale = 8): Buffer {
  const cellWidth = SHEET_UNIT_W * scale;
  const svg = budSheetSvg(look, cellWidth);
  const png = new Resvg(svg, {
    fitTo: { mode: 'original' },
    shapeRendering: 2, // geometricPrecision: anti-aliased edges
  })
    .render()
    .asPng();
  return Buffer.from(png);
}

// keep the shared aspect in sync with the game's 16×24 cell
if (VIEW_W * SHEET_UNIT_H !== VIEW_H * SHEET_UNIT_W) throw new Error('Bud view aspect must be 2:3');

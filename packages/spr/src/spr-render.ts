import type { Sprite } from "./types.js";

const DENSITY = [" ", "▪", "░", "▒", "▓", "█"] as const;

export function renderAscii(sprite: Sprite): string {
  const { rgba, width, height } = sprite;
  let result = "";

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = rgba[i + 3]!;
      if (a === 0) {
        result += " ";
      } else {
        const brightness = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
        const level = Math.min(
          DENSITY.length - 1,
          Math.floor((brightness / 255) * (DENSITY.length - 1)) + 1,
        );
        result += DENSITY[level];
      }
    }
    result += "\n";
  }

  return result;
}

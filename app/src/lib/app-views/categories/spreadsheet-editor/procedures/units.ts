const POINTS_PER_PIXEL = 0.75;

export const pointsOf = (pixels: number): number => Math.round(pixels * POINTS_PER_PIXEL * 10) / 10;

export const pixelsOf = (points: number): number => Math.round(points / POINTS_PER_PIXEL);

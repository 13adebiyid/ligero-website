export const INTRO_DURATION = 3000;
export const INTRO_FADE_DURATION = 650;
export const IDLE_DELAY = 20000;
export const DRIFT_SPEED = 30;
export function introColumn(index, columns) {
  return columns === 2 ? [220, 300][index % 2] : [130, 210, 170][index % 3];
}
export function neighbors(index, count, columns) {
  const result = [];
  const row = Math.floor(index / columns), column = index % columns;
  for (let r = Math.max(0, row - 2); r <= row + 2; r++) {
    for (let c = Math.max(0, column - 2); c <= Math.min(columns - 1, column + 2); c++) {
      const other = r * columns + c;
      if (other < count && other !== index) result.push(other);
    }
  }
  return result;
}
export function easeScroll(current, target, elapsed) {
  const next = current + (target - current) * (1 - Math.pow(.9, elapsed / (1000 / 60)));
  return Math.abs(target - next) < .1 ? target : next;
}

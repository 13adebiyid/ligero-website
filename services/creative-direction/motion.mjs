export const INTRO_DURATION = 3700;
export const TRANSITION_DURATION = 1200;
export const clamp = value => Math.max(0, Math.min(1, value));
export const mix = (from, to, progress) => from + (to - from) * progress;

export function powerInOut(value) {
  const t = clamp(value);
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

export function expoInOut(value) {
  const t = clamp(value);
  if (t === 0 || t === 1) return t;
  return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
}

export function stackEase(value) {
  const x = clamp(value);
  const curve = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let low = 0, high = 1;
  for (let i = 0; i < 22; i++) {
    const middle = (low + high) / 2;
    if (curve(middle, 0.408, 0.374) < x) low = middle;
    else high = middle;
  }
  return x === 0 || x === 1 ? x : curve((low + high) / 2, 0.882, 1);
}

export const fullScale = width => width <= 768 ? 1.05 : 0.98;
export const nextIndex = (index, direction, count) => (index + direction + count) % count;

export function introStates(elapsed, order, width, height) {
  const selected = order.length - 2;
  const cardWidth = width * (width <= 768 ? 338 / 390 : 760 / 1440);
  const cardHeight = cardWidth * 540 / 760;
  const rise = stackEase(elapsed / 2000);
  const expand = expoInOut((elapsed - 1900) / 1800);
  const scale = fullScale(width);
  const states = [];
  order.forEach((id, index) => {
    const start = height + (cardHeight + 20) * index;
    const end = (index - selected) * (cardHeight + 20);
    const y = mix(start, end, rise) + (index - selected) * (height - cardHeight) * expand;
    states[id] = {
      x: 0, y,
      width: mix(cardWidth, width * scale, expand),
      height: mix(cardHeight, height * scale, expand),
      opacity: elapsed >= INTRO_DURATION && index !== selected ? 0 : 1,
      order: order.length - index,
    };
  });
  return states;
}

export function restingStates(active, count, width, height) {
  const scale = fullScale(width);
  return Array.from({length: count}, (_, index) => ({
    x: 0, y: 0, width: width * scale, height: height * scale,
    opacity: index === active ? 1 : 0, order: index === active ? 1 : 0,
  }));
}

export function transitionStates(elapsed, from, to, direction, count, width, height) {
  const states = restingStates(to, count, width, height);
  const slide = powerInOut((elapsed - 200) / 1000);
  const oldScale = mix(fullScale(width), 0.97, powerInOut(elapsed / 200));
  const newScale = mix(0.97, fullScale(width), powerInOut((elapsed - 1000) / 200));
  states[from] = {x: 0, y: -height * direction * slide, width: width * oldScale, height: height * oldScale, opacity: elapsed >= TRANSITION_DURATION ? 0 : 1, order: 0};
  states[to] = {x: 0, y: height * direction * (1 - slide), width: width * newScale, height: height * newScale, opacity: 1, order: 1};
  return states;
}

export function metadataMotion(elapsed, direction, order, height, incoming) {
  const progress = powerInOut((elapsed - 200 - (incoming ? 0 : order * 40)) / 1000);
  return height * direction * 1.5 * (incoming ? 1 - progress : -progress);
}


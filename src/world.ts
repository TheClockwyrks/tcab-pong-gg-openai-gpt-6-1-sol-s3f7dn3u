import * as C from "./constants";
import type { BallState, CaromState, Mode, ObstacleState, State } from "./game";
export const clamp = (x: number, a: number, b: number) =>
  Math.max(a, Math.min(b, x));
export const drawSign = (): 1 | -1 => (Math.random() < 0.5 ? -1 : 1);
export function parked(): BallState {
  return {
    x: C.FIELD_CX,
    y: C.FIELD_CY,
    vx: 0,
    vy: 0,
    spin: 0,
    held: true,
    holdTimer: C.HOLD_TIME,
    serveSign: drawSign(),
    trail: [],
  };
}
export function obstacle(index: number, t: number): ObstacleState {
  const base = C.OBSTACLE_CENTERS[index];
  if (!base) throw new Error("Unknown obstacle index");
  return {
    index,
    cx: base.x,
    cy:
      base.y +
      (index === 0 ? 1 : -1) *
        C.OBSTACLE_SWAY_AMP *
        Math.sin((2 * Math.PI * t) / C.OBSTACLE_SWAY_PERIOD),
    theta: C.OBSTACLE_SPIN_RATE * t,
  };
}
export function initialState(muted = false): CaromState {
  return {
    screen: "title",
    mode: "solo",
    menuIndex: 0,
    titleIndex: 0,
    resumeScreen: "playing",
    score: { p1: 0, p2: 0 },
    winner: null,
    paddles: {
      left: { cy: C.FIELD_CY, vy: 0, driven: false, drivenVy: 0 },
      right: { cy: C.FIELD_CY, vy: 0, driven: false, drivenVy: 0 },
    },
    ai: { tracking: true, movement: true },
    receiver: "left",
    ball: parked(),
    obstacles: [obstacle(0, 0), obstacle(1, 0)],
    obstacleClock: 0,
    obstacleClockRunning: true,
    simTime: 0,
    muted,
  };
}
export function startMatch(s: State, mode: Mode): CaromState {
  const fresh = initialState(s.muted);
  return {
    ...fresh,
    ai: s.ai,
    mode,
    screen: "countdown",
    titleIndex: s.titleIndex,
    simTime: s.simTime,
    paddles: {
      left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
      right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
    },
  };
}
export function title(s: State): CaromState {
  return {
    ...initialState(s.muted),
    titleIndex: s.titleIndex,
    menuIndex: s.titleIndex,
    simTime: s.simTime,
  };
}

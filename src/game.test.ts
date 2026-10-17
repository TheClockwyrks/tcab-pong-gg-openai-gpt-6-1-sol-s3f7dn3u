import { afterEach, describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import type { CaromState, CaromDebugApi } from "./game";
import type { Engine } from "@clockwyrks/simple-2d";
import * as C from "./constants";
const engines: Engine<CaromState, CaromDebugApi>[] = [];
afterEach(() => {
  for (const e of engines.splice(0)) e.destroy();
});
async function setup(ms = 8) {
  const events = new EventTarget();
  const canvas = createCanvas(
    C.FIELD_W,
    C.FIELD_H,
  ) as unknown as HTMLCanvasElement;
  const e = createEngine({
    canvas,
    width: C.FIELD_W,
    height: C.FIELD_H,
    game,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  engines.push(e);
  await e.initialize();
  const key = (code: string, type = "keydown") => {
    const event = new Event(type);
    Object.assign(event, { code, repeat: false });
    events.dispatchEvent(event);
  };
  const press = async (code: string) => {
    key(code);
    await e.advance(1);
    key(code, "keyup");
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) => {
    const event = new Event(type);
    Object.assign(event, {
      clientX: x,
      clientY: y,
      pointerId: id,
      pointerType: device,
      isPrimary: id === 1,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
    });
    events.dispatchEvent(event);
  };
  return { e, d: e.debug, key, press, pointer };
}
async function field(ms = 8) {
  const h = await setup(ms);
  h.e.apply((s) => h.d.setScreen(h.d.clearWorld(s), "playing"));
  h.e.apply((s) => h.d.spawnBall(s));
  h.e.apply((s) => h.d.setBallHeld(s, false));
  h.e.apply((s) => h.d.setMode(s, "versus"));
  return h;
}
describe("engine integration and state transitions", () => {
  it("initializes the complete state and pure diagnostic surface", async () => {
    const { e, d } = await setup();
    const before = d.snapshot(e.state);
    expect(before.version).toBe(C.CAROM_DEBUG_VERSION);
    expect(before.screen).toBe("title");
    expect(before.ball?.speed).toBe(0);
    expect(before.obstacles).toHaveLength(2);
    expect(e.diagnostics().length).toBeGreaterThanOrEqual(10);
    expect(e.diagnostics().every((x) => !x.error)).toBe(true);
    expect(d.snapshot(e.state)).toEqual(before);
    expect(d.reconcile(e.state)).toEqual(e.state);
    expect(d.menuItemRect(e.state, 3)).toBeNull();
  });
  it("navigates, remembers title selection, explains play, and resets", async () => {
    const { e, d, press } = await setup();
    await press("KeyW");
    expect(e.state.menuIndex).toBe(2);
    await press("Enter");
    expect(e.state.screen).toBe("howto");
    expect(e.state.titleIndex).toBe(2);
    await press("Escape");
    expect(e.state.screen).toBe("title");
    expect(e.state.menuIndex).toBe(2);
    await press("ArrowUp");
    await press("Enter");
    expect(e.state.mode).toBe("versus");
    expect(e.state.screen).toBe("countdown");
    expect(e.state.ball?.holdTimer).toBeCloseTo(C.HOLD_TIME - 0.008);
    e.apply((s) => d.reset(s));
    expect(e.state.simTime).toBe(0);
    expect(e.state.titleIndex).toBe(0);
  });
  it("gives up priority over down and navigation over confirm", async () => {
    const { e, key } = await setup();
    key("KeyW");
    key("ArrowDown");
    key("Enter");
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    expect(e.state.menuIndex).toBe(2);
  });
  it("serves once, using its posed sign and receiver, then advances", async () => {
    const { e, d } = await setup(10);
    e.apply((s) => d.setScreen(s, "countdown"));
    e.apply((s) => d.setBallServeSign(s, -1));
    e.apply((s) => d.setBallHoldTimer(s, 0.005));
    await e.advance(1);
    expect(e.state.screen).toBe("playing");
    expect(e.state.ball?.x).toBe(C.FIELD_CX);
    expect(e.state.ball?.vx).toBeCloseTo(
      -C.SERVE_SPEED * Math.cos(C.SERVE_ANGLE),
    );
    expect(e.state.ball?.vy).toBeCloseTo(
      -C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
    );
    await e.advance(1);
    expect(e.state.ball!.x).toBeLessThan(C.FIELD_CX);
  });
  it("pauses on one Escape, freezes the field, and resumes once", async () => {
    const { e, press } = await setup();
    await press("Enter");
    await press("Escape");
    expect(e.state.screen).toBe("paused");
    const held = e.state.ball,
      clock = e.state.obstacleClock;
    await e.advance(3);
    expect(e.state.ball).toEqual(held);
    expect(e.state.obstacleClock).toBe(clock);
    await press("Escape");
    expect(e.state.screen).toBe("countdown");
    expect(e.state.obstacleClock).toBeGreaterThan(clock);
  });
  it("restarts and quits from pause, preserving the title selection", async () => {
    const { e, press } = await setup();
    await press("ArrowDown");
    await press("Enter");
    await press("KeyP");
    await press("ArrowDown");
    await press("Enter");
    expect(e.state.screen).toBe("countdown");
    expect(e.state.mode).toBe("versus");
    await press("KeyP");
    await press("ArrowUp");
    await press("Enter");
    expect(e.state.screen).toBe("title");
    expect(e.state.menuIndex).toBe(1);
    expect(e.state.ball?.held).toBe(true);
  });
  it("accepts pointer and touch confirms across frames, rejects split regions", async () => {
    const { e, d, pointer } = await setup();
    const r = d.menuItemRect(e.state, 1)!;
    pointer("pointermove", r.x + 20, r.y + 20);
    await e.advance(1);
    expect(e.state.menuIndex).toBe(1);
    pointer("pointerdown", r.x + 20, r.y + 20);
    await e.advance(1);
    pointer("pointerup", r.x + 20, r.y + 20);
    await e.advance(1);
    expect(e.state.mode).toBe("versus");
    e.apply((s) => d.reset(s));
    const first = d.menuItemRect(e.state, 0)!;
    pointer("pointerdown", first.x + 10, first.y + 10, 2, "touch");
    pointer("pointerup", r.x + 10, r.y + 10, 2, "touch");
    await e.advance(1);
    expect(e.state.screen).toBe("title");
    pointer("pointerdown", r.x + 20, r.y + 20, 2, "touch");
    pointer("pointerup", r.x + 20, r.y + 20, 2, "touch");
    await e.advance(1);
    expect(e.state.screen).toBe("countdown");
  });
  it("mutes from every screen and resets without unmuting", async () => {
    const { e, d, press } = await setup();
    await press("KeyM");
    expect(e.state.muted).toBe(true);
    e.apply((s) => d.reset(s));
    expect(e.state.muted).toBe(true);
    e.apply((s) => d.setMuted(s, false));
    await e.advance(1);
    expect(e.state.muted).toBe(false);
  });
});
describe("physics, paddles and scoring", () => {
  it("integrates driven velocity and clamps actual velocity at the edge", async () => {
    const { e, d } = await field();
    e.apply((s) => d.setPaddleCy(s, "left", C.PADDLE_MAX_CY - 2));
    e.apply((s) => d.setPaddleVy(s, "left", C.PADDLE_SPEED));
    e.apply((s) => d.setPaddleDriven(s, "left", true));
    expect(e.state.paddles.left.vy).toBe(0);
    await e.advance(1);
    expect(e.state.paddles.left.cy).toBe(C.PADDLE_MAX_CY);
    expect(e.state.paddles.left.vy).toBe(250);
    await e.advance(1);
    expect(e.state.paddles.left.vy).toBe(0);
    expect(e.state.paddles.left.drivenVy).toBe(C.PADDLE_SPEED);
  });
  it("moves both human paddles independently and aliases arrows in Solo", async () => {
    const { e, d, key } = await field(10);
    key("KeyW");
    key("ArrowDown");
    await e.advance(1);
    expect(e.state.paddles.left.cy).toBeCloseTo(
      C.FIELD_CY - C.PADDLE_SPEED * 0.01,
    );
    expect(e.state.paddles.right.cy).toBeCloseTo(
      C.FIELD_CY + C.PADDLE_SPEED * 0.01,
    );
    key("KeyW", "keyup");
    e.apply((s) => d.setMode(s, "solo"));
    const left = e.state.paddles.left.cy;
    await e.advance(1);
    expect(e.state.paddles.left.cy).toBeCloseTo(left + C.PADDLE_SPEED * 0.01);
  });
  it("reflects at walls, preserves speed and decays spin", async () => {
    const { e, d } = await field();
    e.apply((s) => d.setBallPosition(s, 300, C.BALL_R + 1));
    e.apply((s) => d.setBallVelocity(s, 0, -800));
    e.apply((s) => d.setBallSpin(s, 50));
    await e.advance(1);
    expect(e.state.ball!.vy).toBeGreaterThan(0);
    expect(d.snapshot(e.state).ball?.speed).toBeCloseTo(800);
    expect(e.state.ball!.spin).toBeCloseTo(
      50 * Math.pow(0.5, 0.008 / C.SPIN_HALFLIFE),
    );
  });
  it("bounces at a moving paddle with speed gain and signed spin", async () => {
    const { e, d } = await field();
    e.apply((s) => d.setBallPosition(s, C.P1_X1 + C.BALL_R + 2, C.FIELD_CY));
    e.apply((s) => d.setBallVelocity(s, -900, 0));
    e.apply((s) => d.setPaddleVy(s, "left", 300));
    e.apply((s) => d.setPaddleDriven(s, "left", true));
    const cues: string[] = [];
    e.events.on("cue:played", (x) => cues.push(x.cue));
    await e.advance(1);
    expect(e.state.ball!.vx).toBeGreaterThan(0);
    expect(d.snapshot(e.state).ball!.speed).toBeCloseTo(900 * C.SPEED_MULT);
    expect(e.state.ball!.spin).toBeGreaterThan(250);
    expect(cues).toEqual([C.CUES.paddleHit]);
  });
  it("handles end caps without speed gain", async () => {
    const { e, d } = await field();
    e.apply((s) =>
      d.setBallPosition(
        s,
        (C.P1_X0 + C.P1_X1) / 2,
        C.FIELD_CY - C.PADDLE_HALF - C.BALL_R - 1,
      ),
    );
    e.apply((s) => d.setBallVelocity(s, 0, 500));
    await e.advance(1);
    expect(e.state.ball!.vy).toBe(-500);
    expect(e.state.ball!.y).toBeLessThanOrEqual(
      C.FIELD_CY - C.PADDLE_HALF - C.BALL_R,
    );
  });
  it("resolves tilted obstacle faces and embedded centers", async () => {
    const { e, d } = await field(2);
    e.apply((s) => d.spawnObstacle(s, 0));
    e.apply((s) => d.setObstacleClock(s, 0.75));
    e.apply((s) => d.setObstacleClockRunning(s, false));
    const o = e.state.obstacles[0],
      nx = Math.cos(o.theta),
      ny = Math.sin(o.theta);
    e.apply((s) =>
      d.setBallPosition(
        s,
        o.cx + nx * (C.OBSTACLE_HW + C.BALL_R - 1),
        o.cy + ny * (C.OBSTACLE_HW + C.BALL_R - 1),
      ),
    );
    e.apply((s) => d.setBallVelocity(s, -500 * nx, -500 * ny));
    await e.advance(1);
    expect(e.state.ball!.vx).toBeGreaterThan(0);
    expect(e.state.ball!.vy).toBeGreaterThan(0);
    expect(d.snapshot(e.state).ball!.speed).toBeCloseTo(500);
    e.apply((s) => d.setBallPosition(s, o.cx, o.cy));
    e.apply((s) => d.setBallVelocity(s, 0, 0));
    await e.advance(1);
    expect(
      Math.hypot(e.state.ball!.x - o.cx, e.state.ball!.y - o.cy),
    ).toBeGreaterThanOrEqual(C.OBSTACLE_HW + C.BALL_R - 0.001);
  });
  it("scores only past a whole ball, parks and serves toward the loser", async () => {
    const { e, d } = await field();
    e.apply((s) => d.setBallPosition(s, C.FIELD_W + C.BALL_R, 400));
    await e.advance(1);
    expect(e.state.score.p1).toBe(0);
    e.apply((s) => d.setBallVelocity(s, 200, 0));
    await e.advance(1);
    expect(e.state.score.p1).toBe(1);
    expect(e.state.receiver).toBe("right");
    expect(e.state.screen).toBe("countdown");
    expect(e.state.ball!.trail).toEqual([]);
    expect(e.state.ball!.held).toBe(true);
  });
  it("plays deuce then ends only with a two point lead", async () => {
    const { e, d, press } = await field();
    e.apply((s) => d.setScore(s, 10, 10));
    e.apply((s) => d.setBallPosition(s, -C.BALL_R - 1, 400));
    await e.advance(1);
    expect(e.state.score).toEqual({ p1: 10, p2: 11 });
    expect(e.state.screen).toBe("countdown");
    e.apply((s) => d.setScreen(s, "playing"));
    e.apply((s) => d.setBallHeld(s, false));
    e.apply((s) => d.setBallPosition(s, -C.BALL_R - 1, 400));
    await e.advance(1);
    expect(e.state.winner).toBe("right");
    expect(e.state.screen).toBe("matchover");
    await press("Enter");
    expect(e.state.score).toEqual({ p1: 0, p2: 0 });
    expect(e.state.screen).toBe("countdown");
  });
  it("uses AI sensing, movement gates and home rule", async () => {
    const { e, d } = await field();
    e.apply((s) => d.setMode(s, "solo"));
    e.apply((s) => d.setBallPosition(s, 900, 600));
    e.apply((s) => d.setBallVelocity(s, 500, 0));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(C.AI_SPEED);
    e.apply((s) => d.setAiMovement(s, false));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(0);
    e.apply((s) => d.setAiMovement(s, true));
    e.apply((s) => d.setAiTracking(s, false));
    e.apply((s) => d.setPaddleCy(s, "right", 600));
    await e.advance(1);
    expect(e.state.paddles.right.vy).toBe(-C.AI_SPEED);
  });
  it("keeps state immutable, absent entities inert, and debug failures loud", async () => {
    const { e, d } = await field();
    const old = e.state;
    const serialized = JSON.stringify(old);
    await e.advance(2);
    expect(JSON.stringify(old)).toBe(serialized);
    e.apply((s) => d.clearWorld(s));
    expect(() => d.setBallSpin(e.state, 1)).toThrow("No ball");
    expect(() => d.spawnObstacle(e.state, 2)).toThrow();
    const clock = e.state.obstacleClock;
    await e.advance(1);
    expect(e.state.ball).toBeNull();
    expect(e.state.obstacles).toEqual([]);
    expect(e.state.obstacleClock).toBeGreaterThan(clock);
  });
  it("holds obstacle pose when stopped and samples only a time-limited trail", async () => {
    const { e, d } = await field(16);
    e.apply((s) => d.setBallPosition(s, 600, 350));
    e.apply((s) => d.setBallVelocity(s, 100, 10));
    e.apply((s) => d.setObstacleClockRunning(s, false));
    await e.advance(12);
    expect(e.state.obstacleClock).toBe(0);
    expect(e.state.ball!.trail.length).toBeGreaterThan(2);
    expect(
      e.state.ball!.trail.every((p) => e.state.simTime - p.t <= C.TRAIL_TIME),
    ).toBe(true);
  });
  it("agrees under two frame lengths over a wall-banking flight", async () => {
    const results = [];
    for (const ms of [2, 16]) {
      const { e, d } = await field(ms);
      e.apply((s) => d.setBallPosition(s, 500, 80));
      e.apply((s) => d.setBallVelocity(s, 180, -500));
      e.apply((s) => d.setBallSpin(s, 220));
      await e.advance(800 / ms);
      results.push(d.snapshot(e.state).ball!);
    }
    expect(results[0].speed).toBeCloseTo(results[1].speed, 6);
    expect(Math.sign(results[0].vx)).toBe(Math.sign(results[1].vx));
    expect(Math.sign(results[0].vy)).toBe(Math.sign(results[1].vy));
    expect(Math.abs(results[0].x - results[1].x)).toBeLessThan(5);
  });
});

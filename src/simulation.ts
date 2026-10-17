import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { CaromState, PaddleState, State } from "./game";
import { clamp, obstacle, parked } from "./world";
import { readInput } from "./menus";
import { flight } from "./physics";
function move(p: PaddleState, velocity: number, dt: number): PaddleState {
  const vy = p.driven ? p.drivenVy : velocity,
    raw = p.cy + vy * dt,
    cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: cy !== raw && dt > 0 ? (cy - p.cy) / dt : vy };
}
export function update(state: State, api: UpdateApi, dt: number): CaromState {
  let s = readInput(state, api);
  s = { ...s, simTime: state.simTime + dt };
  if (s.screen !== "countdown" && s.screen !== "playing") return s;
  const v = (name: C.ActionName) => api.input.value(name) > 0;
  const up = v("p1-up") || (s.mode === "solo" && v("p2-up")),
    down = v("p1-down") || (s.mode === "solo" && v("p2-down"));
  let rightVy = (Number(v("p2-down")) - Number(v("p2-up"))) * C.PADDLE_SPEED;
  if (s.mode === "solo") {
    let target = C.AI_HOME_Y,
      deadzone = C.AI_HOME_DEADZONE;
    if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
      target = s.ball.y - s.ball.vy * C.AI_REACT;
      deadzone = C.AI_DEADZONE;
    }
    const diff = target - s.paddles.right.cy;
    rightVy =
      s.ai.movement && Math.abs(diff) > deadzone
        ? Math.sign(diff) *
          Math.min(C.AI_SPEED, dt > 0 ? Math.abs(diff) / dt : 0)
        : 0;
  }
  s = {
    ...s,
    paddles: {
      left: move(
        s.paddles.left,
        (Number(down) - Number(up)) * C.PADDLE_SPEED,
        dt,
      ),
      right: move(s.paddles.right, rightVy, dt),
    },
  };
  const events = new Set<C.CueName>();
  let b = s.ball;
  if (b) {
    if (s.screen === "countdown") {
      const holdTimer = Math.max(0, b.holdTimer - dt);
      b = { ...b, holdTimer };
      if (holdTimer <= 0) {
        b = {
          ...b,
          held: false,
          trail: [],
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: b.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
        };
        s = { ...s, screen: "playing" };
      }
    } else if (!b.held) b = flight(s, b, dt, events);
    b = {
      ...b,
      trail: [...b.trail, { x: b.x, y: b.y, t: s.simTime }].filter(
        (p) => s.simTime - p.t <= C.TRAIL_TIME,
      ),
    };
    s = { ...s, ball: b };
    if (
      s.screen === "playing" &&
      (b.x - C.BALL_R > C.FIELD_W || b.x + C.BALL_R < 0)
    ) {
      const left = b.x - C.BALL_R > C.FIELD_W,
        score = {
          p1: s.score.p1 + Number(left),
          p2: s.score.p2 + Number(!left),
        };
      const won = left
        ? score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD
        : score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD;
      s = {
        ...s,
        score,
        ...(won
          ? {
              screen: "matchover" as const,
              winner: left ? ("left" as const) : ("right" as const),
              menuIndex: 0,
            }
          : {
              screen: "countdown" as const,
              receiver: left ? ("right" as const) : ("left" as const),
              ball: parked(),
            }),
      };
      events.add(C.CUES.score);
    }
  }
  const t = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  s = {
    ...s,
    obstacleClock: t,
    obstacles: s.obstacles.map((o) => obstacle(o.index, t)),
  };
  for (const cue of events) api.audio.play(cue);
  return s;
}

import * as C from "./constants";
import type { BallState, ObstacleState, PaddleState, State } from "./game";
import { clamp } from "./world";
type MovingBall = { -readonly [K in keyof BallState]: BallState[K] };
function paddle(
  b: MovingBall,
  p: PaddleState,
  x0: number,
  x1: number,
  left: boolean,
  events: Set<C.CueName>,
) {
  const y0 = p.cy - C.PADDLE_HALF,
    y1 = p.cy + C.PADDLE_HALF,
    r = C.BALL_R;
  if (b.x <= x0 - r || b.x >= x1 + r || b.y <= y0 - r || b.y >= y1 + r) return;
  const depths = [b.x - x0 + r, x1 + r - b.x, b.y - y0 + r, y1 + r - b.y];
  const face = depths.indexOf(Math.min(...depths));
  if (face >= 2) {
    b.y = face === 2 ? y0 - r : y1 + r;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    }
    return;
  }
  const inward = face === 0 ? b.vx > 0 : b.vx < 0;
  b.x = face === 0 ? x0 - r : x1 + r;
  if (!inward) return;
  const angle = clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
  const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
  b.vx = (left ? 1 : -1) * speed * Math.cos(angle);
  b.vy = speed * Math.sin(angle);
  b.spin = clamp(
    b.spin + p.vy * C.SPIN_FROM_PADDLE,
    -C.SPIN_CLAMP,
    C.SPIN_CLAMP,
  );
  b.x = left ? C.P1_X1 + r : C.P2_X0 - r;
  events.add(C.CUES.paddleHit);
}
function obstacle(b: MovingBall, o: ObstacleState, events: Set<C.CueName>) {
  const c = Math.cos(o.theta),
    s = Math.sin(o.theta),
    dx = b.x - o.cx,
    dy = b.y - o.cy;
  const lx = dx * c + dy * s,
    ly = -dx * s + dy * c;
  const qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW),
    qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const dist = Math.hypot(lx - qx, ly - qy);
  if (dist >= C.BALL_R) return;
  let nx: number, ny: number, push: number;
  if (dist > 0) {
    nx = (lx - qx) / dist;
    ny = (ly - qy) / dist;
    push = C.BALL_R - dist;
  } else {
    const px = C.OBSTACLE_HW - Math.abs(lx),
      py = C.OBSTACLE_HH - Math.abs(ly);
    if (px <= py) {
      nx = lx < 0 ? -1 : 1;
      ny = 0;
      push = px + C.BALL_R;
    } else {
      nx = 0;
      ny = ly < 0 ? -1 : 1;
      push = py + C.BALL_R;
    }
  }
  const wx = nx * c - ny * s,
    wy = nx * s + ny * c,
    dot = b.vx * wx + b.vy * wy;
  if (dot < 0) {
    b.vx -= 2 * dot * wx;
    b.vy -= 2 * dot * wy;
    events.add(C.CUES.obstacleBounce);
  }
  b.x += wx * push;
  b.y += wy * push;
}
export function flight(
  s: State,
  ball: BallState,
  dt: number,
  events: Set<C.CueName>,
): BallState {
  const b = { ...ball };
  const n = Math.max(
      1,
      Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
    ),
    h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const a = (b.spin / speed) * h,
        c = Math.cos(a),
        sn = Math.sin(a),
        vx = b.vx;
      b.vx = vx * c - b.vy * sn;
      b.vy = vx * sn + b.vy * c;
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      events.add(C.CUES.wallBounce);
    }
    paddle(b, s.paddles.left, C.P1_X0, C.P1_X1, true, events);
    paddle(b, s.paddles.right, C.P2_X0, C.P2_X1, false, events);
    for (const o of s.obstacles) obstacle(b, o, events);
  }
  return b;
}

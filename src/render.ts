import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { State } from "./game";
import { items, menuItemRect } from "./menus";
const INK = "#edf5f3",
  MUTED = "#708492",
  TEAL = "#71f3c5",
  CORAL = "#ff887d",
  GOLD = "#f5c779";
export function render(s: State, { ctx: c }: RenderApi): void {
  const text = (
    str: string,
    x: number,
    y: number,
    size = 16,
    color = MUTED,
    align: CanvasTextAlign = "left",
    weight = 500,
  ) => {
    c.fillStyle = color;
    c.font =
      weight +
      " " +
      size +
      "px " +
      (size >= 40
        ? "'Arial Black', Arial, sans-serif"
        : "'Courier New', monospace");
    c.textAlign = align;
    c.textBaseline = "middle";
    c.fillText(str, x, y);
  };
  const line = (
    x: number,
    y: number,
    x2: number,
    y2: number,
    color: string,
  ) => {
    c.strokeStyle = color;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x2, y2);
    c.stroke();
  };
  const bar = (
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    r = 8,
  ) => {
    c.fillStyle = color;
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.fill();
  };
  const circle = (x: number, y: number, r: number, color: string) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  };
  c.save();
  const bg = c.createRadialGradient(
    C.FIELD_CX,
    C.FIELD_CY,
    40,
    C.FIELD_CX,
    C.FIELD_CY,
    760,
  );
  bg.addColorStop(0, "#14232c");
  bg.addColorStop(1, "#090f19");
  c.fillStyle = bg;
  c.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  // Fine court markings sit beneath the active bodies.
  c.strokeStyle = "#1a2a34";
  c.lineWidth = 1;
  c.strokeRect(24, 24, C.FIELD_W - 48, C.FIELD_H - 48);
  for (let x = 104; x < C.FIELD_W - 50; x += 48)
    for (let y = 120; y < C.FIELD_H - 65; y += 48) circle(x, y, 0.7, "#253640");
  c.setLineDash([5, 13]);
  line(C.NET_X, 112, C.NET_X, 645, "#30414b");
  c.setLineDash([]);
  c.strokeStyle = "#24343e";
  c.beginPath();
  c.arc(C.FIELD_CX, C.FIELD_CY, 82, 0, 2 * Math.PI);
  c.stroke();
  const menu =
    s.screen === "title" ||
    s.screen === "howto" ||
    s.screen === "paused" ||
    s.screen === "matchover";
  c.save();
  if (menu) c.globalAlpha = s.screen === "title" ? 0.4 : 0.24;
  for (const o of s.obstacles) {
    c.save();
    c.translate(o.cx, o.cy);
    c.rotate(o.theta);
    c.shadowColor = GOLD;
    c.shadowBlur = 22;
    bar(-C.OBSTACLE_HW, -C.OBSTACLE_HH, C.OBSTACLE_W, C.OBSTACLE_H, GOLD, 6);
    c.shadowBlur = 0;
    line(0, -C.OBSTACLE_HH + 14, 0, C.OBSTACLE_HH - 14, "#b0803c");
    circle(0, 0, 3, "#fff2d6");
    c.restore();
  }
  for (const side of ["left", "right"] as const) {
    const x = side === "left" ? C.P1_X0 : C.P2_X0,
      color = side === "left" ? TEAL : CORAL,
      p = s.paddles[side];
    c.shadowColor = color;
    c.shadowBlur = 24;
    bar(x, p.cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, color);
    c.shadowBlur = 0;
    bar(x + 5, p.cy - 24, 2, 48, "#ffffff60", 1);
  }
  if (s.ball) {
    const b = s.ball;
    for (let i = 1; i < b.trail.length; i++) {
      const a = b.trail[i - 1],
        p = b.trail[i];
      c.globalAlpha =
        (menu ? 0.24 : 1) *
        Math.max(0, 1 - (s.simTime - p.t) / C.TRAIL_TIME) *
        0.55;
      c.strokeStyle = TEAL;
      c.lineWidth = C.BALL_R * 1.6;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(p.x, p.y);
      c.stroke();
    }
    c.globalAlpha = menu ? 0.24 : 1;
    c.shadowColor = "#d8fff1";
    c.shadowBlur = 24;
    circle(b.x, b.y, C.BALL_R, INK);
    c.shadowBlur = 0;
  }
  c.restore();
  // Persistent small-print establishes the court as a designed instrument.
  text("C /", 48, 54, 23, TEAL, "left", 700);
  text("CAROM   /   PADDLE DUEL", 110, 54, 12);
  circle(1045, 54, 3, s.muted ? MUTED : TEAL);
  text(s.muted ? "M  SOUND OFF" : "M  SOUND ON", 1060, 54, 12);
  line(48, 82, 1232, 82, "#263640");
  if (!menu || s.screen === "paused") {
    text(
      s.mode === "solo" ? "01  YOU" : "01  PLAYER ONE",
      C.FIELD_CX - 88,
      112,
      11,
      TEAL,
      "right",
    );
    text(
      s.mode === "solo" ? "CPU  /  SOLO" : "02  PLAYER TWO",
      C.FIELD_CX + 88,
      112,
      11,
      CORAL,
    );
    text(
      String(s.score.p1).padStart(2, "0"),
      C.FIELD_CX - 88,
      166,
      64,
      TEAL,
      "right",
      700,
    );
    text(
      String(s.score.p2).padStart(2, "0"),
      C.FIELD_CX + 88,
      166,
      64,
      CORAL,
      "left",
      700,
    );
    text(
      s.mode === "solo" ? "SOLO  /  HUMAN VS MACHINE" : "VERSUS  /  LOCAL DUEL",
      C.FIELD_CX,
      665,
      11,
      MUTED,
      "center",
    );
    text("W / S", 48, 665, 12, TEAL);
    text(
      s.mode === "solo" ? "W/S OR ↑/↓" : "↑ / ↓",
      1232,
      665,
      12,
      CORAL,
      "right",
    );
    text("P  PAUSE", C.FIELD_CX, 696, 10, MUTED, "center");
  }
  if (s.screen === "countdown") {
    text("READY TO RICOCHET?", C.FIELD_CX, 285, 14, INK, "center");
    text(
      String(Math.max(1, Math.ceil(s.ball?.holdTimer ?? 1))),
      C.FIELD_CX,
      435,
      42,
      INK,
      "center",
      700,
    );
    text(
      "SERVING " + (s.receiver === "left" ? "LEFT" : "RIGHT"),
      C.FIELD_CX,
      478,
      11,
      TEAL,
      "center",
    );
  }
  if (menu) {
    // Opaque central plate keeps the menu legible over a frozen rally.
    const panel = c.createLinearGradient(360, 0, 920, 0);
    panel.addColorStop(0, "#090f1900");
    panel.addColorStop(0.18, "#0d1722f8");
    panel.addColorStop(0.82, "#0d1722f8");
    panel.addColorStop(1, "#090f1900");
    c.fillStyle = panel;
    c.fillRect(330, 90, 620, 556);
    if (s.screen === "title") {
      text("A GAME OF ANGLES & INSTINCT", C.FIELD_CX, 166, 12, TEAL, "center");
      text(C.TITLE_TEXT, C.FIELD_CX, 241, 100, INK, "center", 900);
      text(
        "BEND THE RALLY. FIND YOUR ANGLE.",
        C.FIELD_CX,
        308,
        13,
        MUTED,
        "center",
      );
      text("01", 178, 268, 12, TEAL);
      line(178, 290, 260, 290, TEAL);
      text("MOVE", 178, 320, 11);
      text("STRIKE", 178, 344, 11);
      text("CURVE", 178, 368, 11);
      text("02", 1080, 453, 12, GOLD);
      line(1000, 480, 1100, 480, GOLD);
      text("BANK IT.", 1100, 512, 11, GOLD, "right");
    } else if (s.screen === "paused") {
      text("RALLY ON HOLD", C.FIELD_CX, 182, 12, TEAL, "center");
      text("PAUSED", C.FIELD_CX, 253, 64, INK, "center", 800);
      text(
        "Take a breath. The next angle is yours.",
        C.FIELD_CX,
        310,
        13,
        MUTED,
        "center",
      );
    } else if (s.screen === "matchover") {
      text("MATCH COMPLETE", C.FIELD_CX, 155, 12, GOLD, "center");
      text(
        s.winner === "left"
          ? "PLAYER ONE WINS"
          : s.mode === "solo"
            ? "MACHINE WINS"
            : "PLAYER TWO WINS",
        C.FIELD_CX,
        221,
        44,
        INK,
        "center",
        800,
      );
      text(
        s.score.p1 + "  :  " + s.score.p2,
        C.FIELD_CX,
        293,
        48,
        s.winner === "left" ? TEAL : CORAL,
        "center",
        700,
      );
    } else {
      text("FIELD GUIDE", C.FIELD_CX, 142, 12, TEAL, "center");
      text("HOW TO PLAY", C.FIELD_CX, 201, 52, INK, "center", 800);
      const sections = [
        [
          "01   TAKE YOUR SIDE",
          "SOLO: W / S or ↑ / ↓  •  VERSUS: W / S vs ↑ / ↓",
        ],
        [
          "02   PUT A CURVE ON IT",
          "Move your paddle as you strike to add spin.",
        ],
        [
          "03   PLAY THE ANGLES",
          "Bank off the rotating gold bars. Beat the far edge.",
        ],
        [
          "04   FINISH THE DUEL",
          "First to " +
            C.WIN_SCORE +
            ", win by " +
            C.WIN_LEAD +
            ". P / Esc pauses. M mutes.",
        ],
      ];
      sections.forEach(([heading, body], i) => {
        text(heading, 410, 279 + i * 70, 12, i === 2 ? GOLD : TEAL);
        text(body, C.FIELD_CX, 306 + i * 70, 12, INK, "center");
      });
    }
    items(s).forEach((item, i) => {
      const r = menuItemRect(s, i);
      if (!r) return;
      const active = i === s.menuIndex;
      bar(r.x, r.y, r.w, r.h, active ? TEAL : "#15232f", 5);
      if (!active) {
        c.strokeStyle = "#2b3b47";
        c.lineWidth = 1;
        c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      }
      text(
        String(i + 1).padStart(2, "0"),
        r.x + 20,
        r.y + r.h / 2,
        11,
        active ? "#26564c" : MUTED,
      );
      text(
        item,
        C.FIELD_CX,
        r.y + r.h / 2,
        16,
        active ? "#09271f" : INK,
        "center",
        700,
      );
      if (active)
        text("↗", r.x + r.w - 23, r.y + r.h / 2, 20, "#09271f", "center");
    });
    text(
      "↑ ↓  SELECT     ↵  CONFIRM",
      C.FIELD_CX,
      s.screen === "howto" ? 658 : 597,
      11,
      MUTED,
      "center",
    );
    if (s.screen === "title") {
      text("SPIN CHANGES EVERYTHING", 48, 665, 11, MUTED);
      text("SOLO / LOCAL TWO-PLAYER", 1232, 665, 11, MUTED, "right");
    }
  }
  c.restore();
}

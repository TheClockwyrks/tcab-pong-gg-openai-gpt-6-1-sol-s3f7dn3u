import { describe, expect, it } from "vitest";
import { createDebug } from "./debug";
import { initialState } from "./world";
import * as C from "./constants";
describe("atomic debug poses", () => {
  it("poses each independent field and reports derived readings immediately", () => {
    const d = createDebug();
    let s = initialState();
    s = d.setScreen(s, "paused");
    s = d.setMode(s, "versus");
    s = d.setMenuIndex(s, 2);
    s = d.setTitleIndex(s, 1);
    s = d.setResumeScreen(s, "countdown");
    s = d.setScore(s, 8, 9);
    s = d.setWinner(s, "right");
    s = d.setReceiver(s, "right");
    s = d.setBallVelocity(s, 300, 400);
    s = d.setBallPosition(s, 210, 220);
    s = d.setBallSpin(s, -250);
    s = d.setBallHoldTimer(s, 0.2);
    s = d.setBallHeld(s, false);
    s = d.setBallServeSign(s, -1);
    s = d.setObstacleClock(s, 1.5);
    const snap = d.snapshot(s);
    expect(snap).toMatchObject({
      screen: "paused",
      mode: "versus",
      menuIndex: 2,
      titleIndex: 1,
      resumeScreen: "countdown",
      score: { p1: 8, p2: 9 },
      winner: "right",
      receiver: "right",
      ball: {
        x: 210,
        y: 220,
        speed: 500,
        spin: -250,
        holdTimer: 0.2,
        held: false,
        serveSign: -1,
      },
    });
    expect(s.obstacles[0].theta).toBe(C.OBSTACLE_SPIN_RATE * 1.5);
    expect(s.obstacles[0].cy + s.obstacles[1].cy).toBeCloseTo(C.FIELD_H);
    expect(d.reconcile(d.reconcile(s))).toEqual(d.reconcile(s));
    s = d.clearWorld(s);
    s = d.spawnObstacle(s, 1);
    s = d.spawnObstacle(s, 0);
    expect(s.obstacles.map((o) => o.index)).toEqual([0, 1]);
    s = d.spawnBall(s);
    s = d.drawBallServeSign(s);
    expect([1, -1]).toContain(s.ball!.serveSign);
    expect(d.menuItemRect(d.setScreen(s, "playing"), 0)).toBeNull();
    expect(d.menuItemRect(s, -1)).toBeNull();
  });
  it("draws both signs over independent parkings and preserves posed fields", () => {
    const d = createDebug(),
      signs = new Set<number>();
    let s = initialState();
    s = d.setPaddleDriven(s, "left", true);
    s = d.setPaddleVy(s, "left", 321);
    s = d.setBallSpin(s, 123);
    for (let i = 0; i < 100; i++) {
      s = d.drawBallServeSign(s);
      signs.add(s.ball!.serveSign);
      expect(s.ball!.spin).toBe(123);
    }
    expect(signs.size).toBe(2);
    s = d.spawnBall(s);
    expect(s.paddles.left.driven).toBe(true);
    expect(s.paddles.left.drivenVy).toBe(321);
    s = d.reset(s);
    expect(s.paddles.left.driven).toBe(false);
    expect(s.paddles.left.drivenVy).toBe(0);
  });
});

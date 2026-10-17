import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { CaromState, State } from "./game";
import { startMatch, title } from "./world";
export function items(s: State): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    default:
      return [];
  }
}
export function menuItemRect(s: State, index: number) {
  if (index < 0 || index >= items(s).length || !Number.isInteger(index))
    return null;
  return {
    x: 460,
    y: s.screen === "howto" ? 575 : 350 + index * 68,
    w: 360,
    h: 54,
  };
}
function confirm(s: State): CaromState {
  switch (s.screen) {
    case "title": {
      const next = { ...s, titleIndex: s.menuIndex };
      return s.menuIndex === 2
        ? { ...next, screen: "howto", menuIndex: 0 }
        : startMatch(next, s.menuIndex === 0 ? "solo" : "versus");
    }
    case "howto":
      return title(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen }
        : s.menuIndex === 1
          ? startMatch(s, s.mode)
          : title(s);
    case "matchover":
      return s.menuIndex === 0 ? startMatch(s, s.mode) : title(s);
    default:
      return s;
  }
}
export function readInput(state: State, api: UpdateApi): CaromState {
  const edge = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  const samples = api.input.pointerSamples();
  const contacts = api.input.pointerContacts();
  let s: CaromState = { ...state };
  if (edge.mute) s = { ...s, muted: !s.muted };
  // Synchronize the runtime bit even after a debug pose, without a second clock.
  api.audio.setMuted(s.muted);
  s = { ...s, muted: api.audio.muted() };
  const screen = state.screen;
  if (screen === "playing" || screen === "countdown")
    return edge.pause
      ? {
          ...s,
          resumeScreen: screen,
          screen: "paused",
          menuIndex: 0,
          menuPress: {},
        }
      : s;
  if (screen === "paused" && (edge.pause || edge.back))
    return { ...s, screen: s.resumeScreen, menuPress: {} };
  if ((screen === "howto" || screen === "matchover") && edge.back)
    return title(s);
  const count = items(s).length;
  let keyboardConfirmed = false;
  if (count) {
    if (edge["p1-up"] || edge["p2-up"])
      s = { ...s, menuIndex: (s.menuIndex + count - 1) % count };
    else if (edge["p1-down"] || edge["p2-down"])
      s = { ...s, menuIndex: (s.menuIndex + 1) % count };
    else if (edge.confirm) {
      s = confirm(s);
      keyboardConfirmed = true;
    }
  }
  if (s.screen !== screen) return { ...s, menuPress: {} };
  const presses = { ...s.menuPress };
  const hit = (x: number, y: number) => {
    for (let i = 0; i < count; i++) {
      const r = menuItemRect(state, i);
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
        return i;
    }
    return -1;
  };
  for (const p of samples) {
    const index = hit(p.x, p.y);
    if (index >= 0) s = { ...s, menuIndex: index };
    if (p.type === "down") presses[p.id] = { screen, index };
    if (p.type === "up") {
      if (
        !keyboardConfirmed &&
        index >= 0 &&
        presses[p.id]?.index === index &&
        presses[p.id]?.screen === screen
      ) {
        s = confirm({ ...s, menuIndex: index });
        delete presses[p.id];
        break;
      }
      delete presses[p.id];
    }
  }
  if (s.screen === screen)
    for (const p of contacts) {
      const i = hit(p.x, p.y);
      if (i >= 0) s = { ...s, menuIndex: i };
    }
  return { ...s, menuPress: s.screen === screen ? presses : {} };
}


# Carom

A browser-native paddle duel about spin, angles, and instinct. Move into a strike to bend the ball's flight, bank shots off two swaying, rotating obstacles, and win the race to 11—with a two-point lead. Play Solo against a reactive opponent or Versus with a friend on one keyboard.

## Run

Requires a current Node.js release supported by Vite (Node 22.12+).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No backend, credentials, downloaded art, or audio files are needed. All graphics and four sound cues are generated in code.

## Production

```sh
npm ci
npm run build
```

Serve `dist/` from the root of any static file server. `npm run preview` previews the production build locally.

## Controls

| Control | Effect |
| --- | --- |
| W / S | Left paddle |
| Up / Down | Right paddle in Versus; also left paddle in Solo |
| Up / Down or W / S | Navigate menus |
| Enter / Space | Confirm |
| P / Escape | Pause / resume |
| Escape | Back from instructions or match results |
| M | Toggle sound |
| Backtick | Engine diagnostics |

Menus also support mouse and touch. Touch play uses the engine's two vertical sliders and menu buttons. Strike while moving to add spin; paddle-edge contacts change the outgoing angle. Walls and gold obstacles reflect the ball without changing its speed. Paddle hits increase speed up to a cap. A one-second hold precedes each serve.

## Development

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The immutable state and exported debug API live in `src/game.ts`. `world.ts` builds states, `menus.ts` resolves input and hit regions, `physics.ts` handles collision substeps, `simulation.ts` advances the match, and `render.ts` draws the court. Tests use the real Simple 2D engine over a Node canvas and counted clock, without a browser. The debug API is returned only through the engine handle, not installed on the page.

Player-facing screenshots and an engine-recorded rally are in `showcase/`.

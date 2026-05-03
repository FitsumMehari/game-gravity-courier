# Gravity Courier

3D parkour puzzle: deliver a **glowing package** across **floating blocks** by **clicking any surface** to make it your new “floor” — run on **walls and ceilings**. Some rooftops are **gravity-locked** (red emissive) until you approach from another surface. The package is **fragile** (stress meter). **Speedrun timer** and **local replay ghosts** (press **G** to toggle) are stored in the browser.

Stack: **Vite**, **TypeScript**, **Three.js** (WebGL 2).

**Repository:** [github.com/FitsumMehari/game-gravity-courier](https://github.com/FitsumMehari/game-gravity-courier)

**Live (GitHub Pages, after Actions deploy):** `https://<user>.github.io/game-gravity-courier/`

## Run locally

```bash
cd gravity-courier
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output: `dist/`. Preview: `npm run preview`

## GitHub Pages

Same setup as the first game (Echo Maze): **Settings → Pages → Source: GitHub Actions**. Push to `main` runs `npm ci && npm run build` with `VITE_BASE=/<repo-name>/` and deploys `dist/` via the workflow.

If the repo was previously on the **`gh-pages` branch** source, switch Pages to **GitHub Actions** so this workflow is used.

For a **custom domain**, set `base` in `vite.config.ts` to `'/'` and configure Pages accordingly.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move along current surface |
| Space | Jump |
| E | Pick up package (near glowing crate) |
| Click | Aim at a surface → new gravity / floor |
| G | Toggle replay ghost (after a finished run) |
| Esc | Pause |

---

MIT-adjacent personal project — polished movement-first prototype.

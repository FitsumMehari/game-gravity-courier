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

The workflow builds and pushes `dist/` to the **`gh-pages` branch** (avoids the slow `deploy-pages` / `github-pages` environment queue).

1. **Settings → Pages → Build and deployment**
2. **Source:** **Deploy from a branch**
3. **Branch:** `gh-pages` / **/** (root)

Push to `main`; Actions runs `npm run build` with `VITE_BASE=/game-gravity-courier/` automatically.

If Pages was set to **GitHub Actions** before, switch it to **branch `gh-pages`** as above so the new workflow actually publishes.

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

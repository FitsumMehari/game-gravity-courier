import "./style.css";
import { GravityGame } from "./GravityGame";
import { LEVEL_01 } from "./levelData";
import { formatTime, loadGhost, saveGhost } from "./replay";

const LEVEL_ID = "level01";

function webgl2(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app missing");

if (!webgl2()) {
  root.innerHTML = `<div class="fatal"><h1>WebGL 2 required</h1><p>Enable GPU acceleration and reload.</p></div>`;
} else {
  boot(root);
}

function boot(rootEl: HTMLDivElement): void {
  let game: GravityGame;
  try {
    game = new GravityGame(LEVEL_01);
  } catch (e) {
    console.error(e);
    rootEl.innerHTML = `<div class="fatal"><h1>Could not start</h1></div>`;
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "game-wrap";
  game.renderer.domElement.tabIndex = 0;
  wrap.appendChild(game.renderer.domElement);

  const hud = document.createElement("div");
  hud.className = "hud";
  hud.innerHTML = `
    <div class="hud-top">
      <span id="hud-time" class="hud-time">—</span>
      <div class="hud-stress">Package<div class="stress-bar"><div id="stress-fill" class="stress-fill"></div></div></div>
      <span class="hud-brand">Gravity Courier</span>
    </div>
    <div class="hud-hints">
      <p class="hud-goal"><strong>Goal:</strong> <kbd>E</kbd> pick up the gold crate, carry it to the <span class="hud-delivery">teal ring</span> (timer + stress bar start when you hold it).</p>
      <p><kbd>WASD</kbd> move · <kbd>Space</kbd> jump · <kbd>Esc</kbd> pause — <strong>aim + click</strong> a face to make that your “down” (gravity). Red-glow blocks block that click.</p>
      <p class="muted-line"><kbd>G</kbd> ghost · Your feet stick to whatever counts as the floor under your current gravity.</p>
    </div>
  `;

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="panel" id="panel-menu">
      <p class="tagline">Parkour delivery</p>
      <h1>Gravity Courier</h1>
      <p><strong>What you’re doing:</strong> You’re a ball courier. Press <kbd>E</kbd> at the yellow crate to start carrying it. The teal ring far ahead is the drop-off. While carrying, don’t smash the package (stress bar).</p>
      <p><strong>Gravity:</strong> Move the mouse to look, then <strong>click the wall/floor/ceiling you want to stand on</strong> — “down” becomes toward that surface. Red-lit tops can’t be chosen until you aim from another block. Walk off edges with a short jump grace.</p>
      <div class="btn-row">
        <button type="button" class="btn-primary" id="btn-start">Run delivery</button>
      </div>
    </div>
    <div class="panel hidden" id="panel-pause">
      <h2>Paused</h2>
      <div class="btn-row">
        <button type="button" class="btn-primary" id="btn-resume">Resume</button>
        <button type="button" class="btn-ghost" id="btn-restart-p">Restart</button>
      </div>
      <button type="button" class="btn-text" id="btn-title-p">Title</button>
    </div>
    <div class="panel hidden" id="panel-won">
      <h2>Delivered</h2>
      <p id="won-line"></p>
      <div class="btn-row">
        <button type="button" class="btn-primary" id="btn-again-w">Again</button>
        <button type="button" class="btn-ghost" id="btn-title-w">Title</button>
      </div>
    </div>
    <div class="panel hidden" id="panel-lost">
      <h2>Package ruined</h2>
      <p>Too much shock — ease into gravity shifts.</p>
      <div class="btn-row">
        <button type="button" class="btn-primary" id="btn-again-l">Retry</button>
        <button type="button" class="btn-ghost" id="btn-title-l">Title</button>
      </div>
    </div>
  `;

  wrap.appendChild(hud);
  wrap.appendChild(overlay);
  rootEl.appendChild(wrap);

  const hudTime = hud.querySelector<HTMLSpanElement>("#hud-time")!;
  const stressFill = hud.querySelector<HTMLDivElement>("#stress-fill")!;
  const panelMenu = overlay.querySelector<HTMLDivElement>("#panel-menu")!;
  const panelPause = overlay.querySelector<HTMLDivElement>("#panel-pause")!;
  const panelWon = overlay.querySelector<HTMLDivElement>("#panel-won")!;
  const panelLost = overlay.querySelector<HTMLDivElement>("#panel-lost")!;
  const wonLine = overlay.querySelector<HTMLParagraphElement>("#won-line")!;

  const keys = new Set<string>();
  /** Menu / pause UI — distinct from in-game win/lose */
  let uiPhase: "menu" | "playing" | "paused" = "menu";
  let ghostVisible = false;
  let prevGamePhase = game.phase;

  const stored = loadGhost(LEVEL_ID);
  if (stored?.samples?.length) {
    game.showGhost(stored.samples);
    ghostVisible = true;
  }

  function syncPanels(): void {
    const inGameHud = uiPhase === "playing" && game.phase === "playing";
    overlay.classList.toggle("hidden", inGameHud);
    panelMenu.classList.toggle("hidden", uiPhase !== "menu");
    panelPause.classList.toggle("hidden", uiPhase !== "paused");
    panelWon.classList.toggle("hidden", game.phase !== "won");
    panelLost.classList.toggle("hidden", game.phase !== "lost");
    hud.style.opacity = inGameHud ? "1" : "0.35";
  }

  function begin(): void {
    game.hideGhost();
    ghostVisible = false;
    game.startRun();
    prevGamePhase = game.phase;
    uiPhase = "playing";
    syncPanels();
    game.renderer.domElement.focus();
    void game.renderer.domElement.requestPointerLock();
  }

  function goTitle(): void {
    uiPhase = "menu";
    game.goMenu();
    game.hideGhost();
    document.exitPointerLock();
    const g = loadGhost(LEVEL_ID);
    if (g?.samples?.length) {
      game.showGhost(g.samples);
      ghostVisible = true;
    }
    syncPanels();
  }

  document.getElementById("btn-start")!.addEventListener("click", () => begin());
  document.getElementById("btn-resume")!.addEventListener("click", () => {
    uiPhase = "playing";
    syncPanels();
    game.renderer.domElement.focus();
    void game.renderer.domElement.requestPointerLock();
  });
  document.getElementById("btn-restart-p")!.addEventListener("click", () => begin());
  document.getElementById("btn-title-p")!.addEventListener("click", () => goTitle());
  document.getElementById("btn-again-w")!.addEventListener("click", () => begin());
  document.getElementById("btn-title-w")!.addEventListener("click", () => goTitle());
  document.getElementById("btn-again-l")!.addEventListener("click", () => begin());
  document.getElementById("btn-title-l")!.addEventListener("click", () => goTitle());

  game.renderer.domElement.addEventListener("click", (e) => {
    if (uiPhase !== "playing" || document.pointerLockElement !== game.renderer.domElement) return;
    const rect = game.renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    game.tryGravityFromClick(x, y);
  });

  const BLOCK_NAV_KEYS = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyE",
    "KeyG",
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ]);

  window.addEventListener("keydown", (e) => {
    if (
      uiPhase === "playing" &&
      game.phase === "playing" &&
      BLOCK_NAV_KEYS.has(e.code) &&
      document.pointerLockElement === game.renderer.domElement
    ) {
      e.preventDefault();
    }
    keys.add(e.code);
    if (e.code === "Escape") {
      if (uiPhase === "playing" && game.phase === "playing") {
        uiPhase = "paused";
        syncPanels();
        document.exitPointerLock();
      } else if (uiPhase === "paused") {
        uiPhase = "playing";
        syncPanels();
        game.renderer.domElement.focus();
        void game.renderer.domElement.requestPointerLock();
      }
      return;
    }
    if (e.repeat) return;
    if (uiPhase === "playing" && game.phase === "playing" && e.code === "KeyG") {
      ghostVisible = !ghostVisible;
      const g = loadGhost(LEVEL_ID);
      if (ghostVisible && g?.samples?.length) game.showGhost(g.samples);
      else game.hideGhost();
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));

  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement !== game.renderer.domElement && uiPhase === "playing" && game.phase === "playing") {
      uiPhase = "paused";
      syncPanels();
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (uiPhase !== "playing" || document.pointerLockElement !== game.renderer.domElement) return;
    game.addMouseLook(e.movementX, e.movementY);
  });

  let last = performance.now();
  function frame(now: number): void {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    if (uiPhase === "playing" && game.phase === "playing") {
      const f = keys.has("KeyW") || keys.has("ArrowUp");
      const b = keys.has("KeyS") || keys.has("ArrowDown");
      const l = keys.has("KeyA") || keys.has("ArrowLeft");
      const r = keys.has("KeyD") || keys.has("ArrowRight");
      const jump = keys.has("Space");
      const interact = keys.has("KeyE");
      game.tick(dt, f, b, l, r, jump, interact);

      hudTime.textContent =
        game.timerActive && game.hasPackage ? formatTime(game.runTime) : game.hasPackage ? formatTime(game.runTime) : "—";
      stressFill.style.width = `${Math.min(100, game.packageStress * 100)}%`;
    } else {
      game.updateGhostPlayback(dt);
    }

    if (game.phase === "won" && prevGamePhase !== "won") {
      const rec = game.getRecording();
      saveGhost(LEVEL_ID, rec, game.runTime);
      const prev = loadGhost(LEVEL_ID);
      wonLine.textContent = `Time ${formatTime(game.runTime)}${prev?.bestTimeSec != null ? ` · best ${formatTime(prev.bestTimeSec)}` : ""}`;
      syncPanels();
      document.exitPointerLock();
    }
    if (game.phase === "lost" && prevGamePhase !== "lost") {
      syncPanels();
      document.exitPointerLock();
    }
    prevGamePhase = game.phase;

    game.render();
  }
  requestAnimationFrame(frame);

  window.addEventListener("resize", () => {
    game.resize(window.innerWidth, window.innerHeight);
  });

  syncPanels();
}

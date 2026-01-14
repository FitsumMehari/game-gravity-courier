import * as THREE from "three";
import {
  DELIVERY_R,
  FALL_RESET_Y,
  GRAVITY_LERP,
  COYOTE_TIME,
  GRAVITY_MAG,
  GROUND_MAX_HORIZ,
  GROUND_PROBE_LEN,
  INTERACT_R,
  JUMP_IMPULSE,
  LOOK_SENS,
  MAX_SPEED,
  MOVE_ACCEL,
  PLAYER_R,
  STRESS_MAX,
  STRESS_PER_JOLT,
} from "./constants";
import type { LevelSpec } from "./levelData";
import type { GhostSample } from "./replay";

export type GamePhase = "menu" | "playing" | "won" | "lost";

export class GravityGame {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly raycaster = new THREE.Raycaster();

  phase: GamePhase = "menu";
  level: LevelSpec;

  /** Current floor direction (away from surface toward sky) */
  worldUp = new THREE.Vector3(0, 1, 0);
  targetWorldUp = new THREE.Vector3(0, 1, 0);

  playerPos = new THREE.Vector3();
  playerVel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;

  hasPackage = false;
  packageStress = 0;
  private readonly packageFollow = new THREE.Vector3();
  private lastVel = new THREE.Vector3();

  runTime = 0;
  timerActive = false;

  platforms = new THREE.Group();
  private readonly colliders: THREE.Mesh[] = [];

  private readonly pickupMesh: THREE.Mesh;
  private readonly packageMesh: THREE.Mesh;
  private readonly deliveryMarker: THREE.Mesh;
  private readonly ghostMesh: THREE.Mesh;
  /** Samples saved after a finished run */
  private recordSamples: GhostSample[] = [];
  /** Loaded ghost path for playback */
  private playbackSamples: GhostSample[] = [];
  private ghostPlaybackT = 0;
  private ghostAccum = 0;

  private readonly tmpV = new THREE.Vector3();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly groundRay = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  /** Ledges: brief window to jump after walking off */
  private coyoteU = 0;

  constructor(level: LevelSpec) {
    this.level = level;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x263652, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(68, 1, 0.12, 220);

    this.scene.fog = new THREE.Fog(0x4a6288, 55, 210);
    this.scene.add(new THREE.AmbientLight(0xb8c8e8, 0.42));
    const hemi = new THREE.HemisphereLight(0xa8d4ff, 0x3a4558, 0.52);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff5e8, 1.35);
    sun.position.set(28, 48, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    this.scene.add(sun);

    this.buildLevel(level);

    const pkGeom = new THREE.BoxGeometry(0.55, 0.45, 0.38);
    const pkMat = new THREE.MeshStandardMaterial({
      color: 0xffee66,
      emissive: 0xffaa22,
      emissiveIntensity: 0.65,
      metalness: 0.2,
      roughness: 0.35,
    });
    this.pickupMesh = new THREE.Mesh(pkGeom, pkMat);
    this.pickupMesh.position.copy(level.pickup);
    this.pickupMesh.castShadow = true;
    this.scene.add(this.pickupMesh);

    const pkgMat = new THREE.MeshStandardMaterial({
      color: 0xa8f0ff,
      emissive: 0x44ddff,
      emissiveIntensity: 0.5,
      metalness: 0.45,
      roughness: 0.25,
      transparent: true,
      opacity: 0.95,
    });
    this.packageMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.38), pkgMat);
    this.packageMesh.visible = false;
    this.packageMesh.castShadow = true;
    this.scene.add(this.packageMesh);

    const delGeom = new THREE.RingGeometry(DELIVERY_R * 0.92, DELIVERY_R, 48);
    const delMat = new THREE.MeshBasicMaterial({
      color: 0x66ffcc,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    this.deliveryMarker = new THREE.Mesh(delGeom, delMat);
    this.deliveryMarker.rotation.x = -Math.PI / 2;
    this.deliveryMarker.position.copy(level.delivery);
    this.deliveryMarker.position.y += 0.05;
    this.scene.add(this.deliveryMarker);

    const gMat = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.ghostMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 14), gMat);
    this.ghostMesh.visible = false;
    this.scene.add(this.ghostMesh);

    this.resize(window.innerWidth, window.innerHeight);
  }

  private buildLevel(level: LevelSpec): void {
    this.platforms.clear();
    this.colliders.length = 0;
    this.scene.add(this.platforms);

    for (const p of level.platforms) {
      const geom = new THREE.BoxGeometry(p.half.x * 2, p.half.y * 2, p.half.z * 2);
      const mat = new THREE.MeshStandardMaterial({
        color: p.color,
        metalness: 0.22,
        roughness: 0.58,
      });
      if (p.gravityLocked) {
        mat.emissive = new THREE.Color(p.lockedTint ?? 0xff2244);
        mat.emissiveIntensity = 0.35;
      }
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(p.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.gravityLocked = !!p.gravityLocked;
      this.platforms.add(mesh);
      this.colliders.push(mesh);
    }

    const grid = new THREE.GridHelper(260, 52, 0x8cb4e8, 0x506080);
    grid.position.y = -3;
    this.scene.add(grid);
  }

  resize(w: number, h: number): void {
    const W = Math.max(1, w);
    const H = Math.max(1, h);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(W, H);
  }

  private tangentBasis(outForward: THREE.Vector3, outRight: THREE.Vector3): void {
    const up = this.worldUp;
    let east = new THREE.Vector3(0, 1, 0);
    if (Math.abs(up.dot(east)) > 0.95) east = new THREE.Vector3(1, 0, 0);
    outRight.crossVectors(east, up);
    outRight.normalize();
    outForward.crossVectors(up, outRight);
    outForward.normalize();
    this.tmpQ.setFromAxisAngle(up, this.yaw);
    outForward.applyQuaternion(this.tmpQ);
    outRight.crossVectors(outForward, up).normalize();
  }

  /**
   * Walk/strafe relative to where the camera looks: view axis with pitch, projected onto the surface.
   * (Yaw-only tangentBasis alone makes WASD disagree with the crosshair when looking up or down.)
   */
  private movementBasis(outMoveF: THREE.Vector3, outMoveR: THREE.Vector3): void {
    const up = this.worldUp;
    this.tangentBasis(outMoveF, outMoveR);
    const baseF = outMoveF.clone();
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const view = baseF.clone().multiplyScalar(cosP).addScaledVector(up, sinP).normalize();
    const along = view.dot(up);
    outMoveF.copy(view).addScaledVector(up, -along);
    if (outMoveF.lengthSq() < 1e-10) {
      outMoveF.copy(baseF);
      outMoveR.crossVectors(outMoveF, up).normalize();
    } else {
      outMoveF.normalize();
      outMoveR.crossVectors(outMoveF, up).normalize();
    }
  }

  /**
   * Third-person camera on the same view axis as WASD / mouse pitch.
   * (Previously: cam offset used pitch but lookAt was a fixed chest point, so the screen
   * never matched “forward” — movement felt random vs crosshair.)
   */
  private alignCamera(): void {
    const up = this.worldUp;
    let forward = new THREE.Vector3();
    let right = new THREE.Vector3();
    this.tangentBasis(forward, right);

    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    this.tmpV.copy(forward).multiplyScalar(cosP).addScaledVector(up, sinP).normalize();

    const eyeH = 1.28;
    const eye = this.playerPos.clone().addScaledVector(up, eyeH);
    const camDist = 9;
    this.camera.position.copy(eye.clone().addScaledVector(this.tmpV, -camDist));
    this.camera.up.copy(up);
    const focus = eye.clone().addScaledVector(this.tmpV, 14);
    this.camera.lookAt(focus);
  }

  /** Pointer lock relative mouse */
  addMouseLook(dx: number, dy: number): void {
    if (this.phase !== "playing") return;
    this.yaw -= dx * LOOK_SENS;
    this.pitch -= dy * LOOK_SENS;
    this.pitch = Math.max(-1.15, Math.min(1.15, this.pitch));
  }

  /** Screen coords -1..1 */
  tryGravityFromClick(ndcX: number, ndcY: number): void {
    if (this.phase !== "playing") return;
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.colliders, false);
    const hit = hits[0];
    if (!hit || !hit.face) return;
    const mesh = hit.object as THREE.Mesh;
    if (mesh.userData.gravityLocked) return;

    const n = hit.face.normal.clone();
    n.transformDirection(mesh.matrixWorld);
    n.normalize();
    this.tmpV.copy(this.playerPos).sub(hit.point).normalize();
    if (n.dot(this.tmpV) < 0) n.negate();
    this.targetWorldUp.copy(n);
  }

  /**
   * Cast from above the player so the ray never starts inside a platform.
   * Must call after `platforms.updateMatrixWorld` so ray hits are correct.
   */
  private groundedProbe(): {
    grounded: boolean;
    idealCenter: THREE.Vector3 | null;
  } {
    this.platforms.updateMatrixWorld(true);
    const up = this.worldUp.clone().normalize();
    const down = up.clone().multiplyScalar(-1).normalize();
    const rayStart = this.playerPos.clone().addScaledVector(up, PLAYER_R + 3.2);
    this.groundRay.set(rayStart, down);
    this.groundRay.far = GROUND_PROBE_LEN;
    const hits = this.groundRay.intersectObjects(this.colliders, false);
    if (hits.length === 0) {
      return { grounded: false, idealCenter: null };
    }
    const h = hits[0]!;
    const surfacePoint = h.point.clone();
    const idealCenter = surfacePoint.clone().addScaledVector(up, PLAYER_R);
    const heightAlong = this.playerPos.clone().sub(surfacePoint).dot(up);
    const horizontal = this.playerPos
      .clone()
      .sub(surfacePoint)
      .sub(up.clone().multiplyScalar(heightAlong))
      .length();
    const grounded =
      heightAlong >= PLAYER_R * 0.12 &&
      heightAlong <= PLAYER_R * 4 &&
      horizontal <= GROUND_MAX_HORIZ &&
      h.distance < GROUND_PROBE_LEN * 0.98;
    return { grounded, idealCenter };
  }

  private integrate(dt: number, forward: boolean, back: boolean, left: boolean, right: boolean, jump: boolean): void {
    const up = this.worldUp;
    this.worldUp.lerp(this.targetWorldUp, 1 - Math.exp(-GRAVITY_LERP * dt)).normalize();

    let f = new THREE.Vector3();
    let r = new THREE.Vector3();
    this.movementBasis(f, r);

    let wish = new THREE.Vector3();
    if (forward) wish.add(f);
    if (back) wish.sub(f);
    if (left) wish.sub(r);
    if (right) wish.add(r);
    if (wish.lengthSq() > 1e-8) wish.normalize();

    const gProbe = this.groundedProbe();
    const grounded = gProbe.grounded;
    if (grounded) {
      this.coyoteU = COYOTE_TIME;
    } else {
      this.coyoteU = Math.max(0, this.coyoteU - dt);
    }

    if (grounded) {
      const vn = this.playerVel.dot(up);
      const tang = this.playerVel.clone().sub(up.clone().multiplyScalar(vn));
      tang.addScaledVector(wish, MOVE_ACCEL * dt);
      tang.multiplyScalar(Math.exp(-8 * dt));
      const cap = Math.min(MAX_SPEED, tang.length());
      tang.normalize().multiplyScalar(cap);
      this.playerVel.copy(tang);
      this.playerVel.addScaledVector(up, vn);

      const canJump = jump && vn <= 0.88;
      if (canJump) {
        this.playerVel.addScaledVector(up, JUMP_IMPULSE);
        this.coyoteU = 0;
      }
    } else {
      this.playerVel.addScaledVector(up, -GRAVITY_MAG * dt);
      const vn = this.playerVel.dot(up);
      const tang = this.playerVel.clone().sub(up.clone().multiplyScalar(vn));
      tang.addScaledVector(wish, MOVE_ACCEL * 0.55 * dt);
      const cap = Math.min(MAX_SPEED * 1.15, tang.length());
      if (tang.lengthSq() > 1e-8) tang.normalize().multiplyScalar(cap);
      this.playerVel.copy(tang).addScaledVector(up, vn);

      const vn2 = this.playerVel.dot(up);
      if (jump && vn2 <= 0.88 && this.coyoteU > 0) {
        this.playerVel.addScaledVector(up, JUMP_IMPULSE);
        this.coyoteU = 0;
      }
    }

    const airFactor = grounded ? 1 : 0.12;
    const jolt = Math.min(
      28,
      this.playerVel.clone().sub(this.lastVel).length() / Math.max(dt, 1e-4),
    );
    if (this.hasPackage && this.timerActive) {
      this.packageStress = Math.min(
        STRESS_MAX,
        this.packageStress + jolt * STRESS_PER_JOLT * 0.0019 * airFactor,
      );
      if (this.packageStress >= STRESS_MAX - 1e-4) {
        this.phase = "lost";
        this.timerActive = false;
      }
    }
    this.lastVel.copy(this.playerVel);

    this.playerPos.addScaledVector(this.playerVel, dt);

    if (this.playerPos.y < FALL_RESET_Y) {
      this.worldUp.set(0, 1, 0);
      this.targetWorldUp.set(0, 1, 0);
      this.playerPos.copy(this.resolveSpawnOnSlab());
      this.playerVel.set(0, 0, 0);
      this.packageStress = Math.min(this.packageStress, 0.35);
    }

    const postGround = this.groundedProbe();
    if (postGround.idealCenter) {
      const d = this.playerPos.distanceTo(postGround.idealCenter);
      if (postGround.grounded) {
        this.playerPos.lerp(postGround.idealCenter, Math.min(1, dt * 12));
      } else if (d < 4.5 && d > 0.02 && this.playerVel.dot(up) < 0.85) {
        this.playerPos.lerp(postGround.idealCenter, Math.min(1, dt * 6));
      }
    }

    if (this.hasPackage) {
      this.tangentBasis(f, r);
      const bob = Math.sin(performance.now() * 0.004) * 0.06;
      this.packageFollow.lerp(
        this.playerPos.clone().addScaledVector(f, 0.65).addScaledVector(up, 0.35 + bob).addScaledVector(r, 0.35),
        1 - Math.exp(-12 * dt),
      );
      this.packageMesh.position.copy(this.packageFollow);
      this.packageMesh.quaternion.copy(this.camera.quaternion);
      this.packageMesh.visible = true;
      this.pickupMesh.visible = false;
    } else {
      const bob = Math.sin(performance.now() * 0.003) * 0.12;
      const bobAxis = up.clone().normalize();
      this.pickupMesh.position.copy(this.level.pickup).addScaledVector(bobAxis, bob);
      this.packageMesh.visible = false;
      this.pickupMesh.visible = true;
    }

    if (this.timerActive && this.hasPackage) {
      this.runTime += dt;
      this.recordGhostSample(dt);
    }

    if (this.hasPackage && this.phase === "playing") {
      const toDel = this.level.delivery.distanceTo(this.playerPos);
      if (toDel < DELIVERY_R) {
        this.phase = "won";
        this.timerActive = false;
      }
    }

    this.alignCamera();
  }

  private recordGhostSample(dt: number): void {
    this.ghostAccum += dt;
    if (this.ghostAccum < 0.09) return;
    this.ghostAccum = 0;
    this.recordSamples.push({
      t: this.runTime,
      px: this.playerPos.x,
      py: this.playerPos.y,
      pz: this.playerPos.z,
      ux: this.worldUp.x,
      uy: this.worldUp.y,
      uz: this.worldUp.z,
    });
    if (this.recordSamples.length > 8000) this.recordSamples.shift();
  }

  updateGhostPlayback(dt: number): void {
    if (!this.ghostMesh.visible || this.playbackSamples.length === 0) return;
    this.ghostPlaybackT += dt;
    const samples = this.playbackSamples;
    let i = 0;
    while (i < samples.length - 1 && samples[i + 1]!.t < this.ghostPlaybackT) i++;
    const a = samples[i]!;
    const b = samples[Math.min(i + 1, samples.length - 1)]!;
    const span = Math.max(b.t - a.t, 1e-4);
    const u = Math.min(1, Math.max(0, (this.ghostPlaybackT - a.t) / span));
    this.ghostMesh.position.set(
      a.px + (b.px - a.px) * u,
      a.py + (b.py - a.py) * u,
      a.pz + (b.pz - a.pz) * u,
    );
    if (this.ghostPlaybackT > samples[samples.length - 1]!.t) this.ghostPlaybackT = 0;
  }

  tick(
    dt: number,
    forward: boolean,
    back: boolean,
    left: boolean,
    right: boolean,
    jump: boolean,
    interact: boolean,
  ): void {
    if (this.phase !== "playing") return;
    const d = Math.min(0.05, Math.max(0, dt));

    if (interact && !this.hasPackage) {
      if (this.pickupMesh.position.distanceTo(this.playerPos) < INTERACT_R) {
        this.hasPackage = true;
        this.timerActive = true;
        this.runTime = 0;
        this.packageStress = 0;
        this.recordSamples = [];
      }
    }

    this.integrate(d, forward, back, left, right, jump);
    this.updateGhostPlayback(d);
  }

  startRun(): void {
    this.phase = "playing";
    this.worldUp.set(0, 1, 0);
    this.targetWorldUp.set(0, 1, 0);
    this.playerPos.copy(this.resolveSpawnOnSlab());
    this.playerVel.set(0, 0, 0);
    this.yaw = this.level.spawnYaw;
    this.pitch = 0;
    this.hasPackage = false;
    this.packageStress = 0;
    this.timerActive = false;
    this.runTime = 0;
    this.lastVel.set(0, 0, 0);
    this.coyoteU = 0;
    this.recordSamples = [];
    this.packageFollow.copy(this.level.pickup);
    this.alignCamera();
  }

  /** Ray along -worldUp from spawn so we sit on the slab (uses current worldUp, set before call). */
  private resolveSpawnOnSlab(): THREE.Vector3 {
    this.platforms.updateMatrixWorld(true);
    const s = this.level.spawn;
    const up = this.worldUp.clone().normalize();
    const rayStart = s.clone().addScaledVector(up, 22);
    const down = up.clone().multiplyScalar(-1).normalize();
    this.groundRay.set(rayStart, down);
    this.groundRay.far = 90;
    const hits = this.groundRay.intersectObjects(this.colliders, false);
    if (hits.length > 0) {
      const top = hits[0]!.point;
      return top.clone().addScaledVector(up, PLAYER_R + 0.15);
    }
    return s.clone();
  }

  goMenu(): void {
    this.phase = "menu";
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }

  /** Load ghost positions from samples for visualization */
  showGhost(samples: GhostSample[]): void {
    if (samples.length === 0) {
      this.ghostMesh.visible = false;
      return;
    }
    this.playbackSamples = samples.slice();
    this.ghostMesh.visible = true;
    this.ghostPlaybackT = 0;
  }

  hideGhost(): void {
    this.ghostMesh.visible = false;
  }

  getRecording(): GhostSample[] {
    return this.recordSamples.slice();
  }
}

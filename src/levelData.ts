import * as THREE from "three";

/** Axis-aligned box platforms + meta */
export interface PlatformSpec {
  pos: THREE.Vector3;
  half: THREE.Vector3;
  color: number;
  /** Ray hits never retarget gravity to this surface */
  gravityLocked?: boolean;
  /** Emitter glow for locked zones */
  lockedTint?: number;
}

export interface LevelSpec {
  /** Player spawn */
  spawn: THREE.Vector3;
  spawnYaw: number;
  /** Package sits here until pickup */
  pickup: THREE.Vector3;
  /** Delivery volume center */
  delivery: THREE.Vector3;
  platforms: PlatformSpec[];
}

/** First platform top Y = 5.2 + 0.6 = 5.8 — spawn center must be ≥ top + PLAYER_R */
export const LEVEL_01: LevelSpec = {
  spawn: new THREE.Vector3(0, 6.55, 4),
  spawnYaw: 0,
  pickup: new THREE.Vector3(0, 7.15, 4),
  delivery: new THREE.Vector3(38, 14, -6),
  platforms: [
    {
      pos: new THREE.Vector3(0, 5.2, 0),
      half: new THREE.Vector3(6, 0.6, 6),
      color: 0x3a6d8c,
    },
    {
      pos: new THREE.Vector3(10, 8, -2),
      half: new THREE.Vector3(4, 0.5, 5),
      color: 0x4a7ab0,
    },
    {
      pos: new THREE.Vector3(18, 11, -4),
      half: new THREE.Vector3(5, 0.45, 4),
      color: 0x5c88b8,
    },
    {
      pos: new THREE.Vector3(26, 13, -5),
      half: new THREE.Vector3(4, 0.4, 4),
      color: 0x4a5568,
      gravityLocked: true,
      lockedTint: 0xff4466,
    },
    {
      pos: new THREE.Vector3(34, 14.5, -6),
      half: new THREE.Vector3(7, 0.55, 7),
      color: 0x2eb89a,
    },
    {
      pos: new THREE.Vector3(8, 14, 8),
      half: new THREE.Vector3(3, 0.35, 10),
      color: 0x6b8cae,
    },
    {
      pos: new THREE.Vector3(-8, 12, -6),
      half: new THREE.Vector3(5, 0.4, 6),
      color: 0x5580a8,
    },
    {
      pos: new THREE.Vector3(-12, 16, -12),
      half: new THREE.Vector3(4, 0.35, 4),
      color: 0x7a9dcb,
    },
    {
      pos: new THREE.Vector3(20, 6, 10),
      half: new THREE.Vector3(8, 0.5, 3),
      color: 0x4678a3,
    },
  ],
};

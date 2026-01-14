/** Player sphere collision radius */
export const PLAYER_R = 0.42;

/** Movement acceleration on surface */
export const MOVE_ACCEL = 46;

/** Max horizontal speed (along tangent plane) */
export const MAX_SPEED = 11;

/** Gravity magnitude along current -up (lower = less “constant falling” in air) */
export const GRAVITY_MAG = 28;

/** Jump impulse along world up */
export const JUMP_IMPULSE = 11;

/** Seconds after leaving a ledge where jump still registers */
export const COYOTE_TIME = 0.11;

/** Mouse look sensitivity */
export const LOOK_SENS = 0.0022;

/** Gravity blend speed when retargeting surface (rad/s approx via lerp factor) */
export const GRAVITY_LERP = 8;

/** Pickup / interaction radius */
export const INTERACT_R = 1.35;

/** Delivery zone radius */
export const DELIVERY_R = 2.2;

/** Package stress per harsh velocity change */
export const STRESS_PER_JOLT = 0.14;

/** Package breaks at 1 */
export const STRESS_MAX = 1;

/** Downward cast length from above the player */
export const GROUND_PROBE_LEN = 40;

/** Max horizontal drift from probe vs ideal center while still “on” the surface */
export const GROUND_MAX_HORIZ = 6;

/** Respawn if player drifts below this world Y (safety net) */
export const FALL_RESET_Y = -35;

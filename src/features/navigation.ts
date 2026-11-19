// openbim-fix:v3:applied -- do not re-apply the earlier fix scripts
/**
 * AEC Nexus 3D Navigation
 *
 *   LMB drag              Orbit around target
 *   RMB drag              Pan
 *   Shift + LMB drag      Pan
 *   Wheel / trackpad      Smooth zoom to cursor
 *   WASD / arrows         Move the camera
 *   R                     Reset view
 *   F                     Fit the model
 *
 * CameraControls mouse/touch are forced OFF so only this module drives the view.
 * Every gesture ends with forceResumeCameraControls to prevent 3D hang-ups.
 */
import { readControlsTarget } from "../core/controls-target";
import * as THREE from "three";
import { ctx } from "../core/context";
import { inputRouter, type Gesture, type Mods } from "../core/input-router";
import { fitAll, zoomBy, pickWorldPointUnderCursor } from "./camera-tools";
import { forceResumeCameraControls } from "../core/camera-gate";

type NavState =
  | { kind: "idle" }
  | {
      kind: "pan";
      startX: number;
      startY: number;
      startTarget: THREE.Vector3;
      startCam: THREE.Vector3;
      right: THREE.Vector3;
      up: THREE.Vector3;
      worldPerPx: number;
      /** View direction and eye-to-target distance at pan start: pan never rotates the view. */
      fwd: THREE.Vector3;
      fwdDist: number;
    }
  | {
      kind: "orbit";
      startX: number;
      startY: number;
      pivot: THREE.Vector3;
      startSpherical: THREE.Spherical;
      pixelsToRadians: number;
    }
  | {
      kind: "box-select";
      startX: number;
      startY: number;
      mode: "window" | "crossing";
    };

let state: NavState = { kind: "idle" };
const cameraMoveKeys = new Set<string>();
let cameraMoveFrame = 0;
let cameraMoveTime = 0;

/**
 * Timestamp (ms, performance.now) of the most recent camera gesture end —
 * pan, orbit, or wheel zoom. Used to suppress dblclick→fitAll snap-back
 * when the user releases MMB and quickly re-clicks (within the input-router's
 * dblclick window of 320 ms).
 *
 * The cooldown is intentionally longer than the dblclick window so a single
 * MMB release + immediate re-click never accidentally fits the whole scene.
 */
let lastNavGestureAt = 0;
const DOUBLE_CLICK_FIT_COOLDOWN_MS = 600;

const blockers: Array<() => boolean> = [];

export function whenNavigationBlocked(fn: () => boolean): () => void {
  blockers.push(fn);
  return () => {
    const i = blockers.indexOf(fn);
    if (i >= 0) blockers.splice(i, 1);
  };
}

function blocked(): boolean {
  for (const b of blockers) {
    try {
      if (b()) return true;
    } catch {
      /* */
    }
  }
  try {
    if ((window as any).__obsPlanVisible?.()) return true;
    if (ctx.features?.drawing?.isActive?.()) return true;
    if (ctx.features?.walkMode?.isEnabled?.()) return true;
  } catch {
    /* */
  }
  return false;
}

export type ClickDelegate = (m: Mods, e: PointerEvent) => boolean;
export type DragDelegate = (g: Extract<Gesture, { kind: "drag-move" }>) => boolean;

const clickDelegates: ClickDelegate[] = [];
const dragDelegates: DragDelegate[] = [];

export function onNavClick(fn: ClickDelegate): () => void {
  clickDelegates.push(fn);
  return () => {
    const i = clickDelegates.indexOf(fn);
    if (i >= 0) clickDelegates.splice(i, 1);
  };
}

export function onNavDrag(fn: DragDelegate): () => void {
  dragDelegates.push(fn);
  return () => {
    const i = dragDelegates.indexOf(fn);
    if (i >= 0) dragDelegates.splice(i, 1);
  };
}

function controls(): any {
  return ctx.world.camera.controls;
}

function camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
  return ctx.world.camera.three as any;
}

function getTarget(out = new THREE.Vector3()): THREE.Vector3 {
  const c = controls();
  if (readControlsTarget(c, out)) return out;
  return out.set(0, 0, 0);
}

function getOrbitPivot(): THREE.Vector3 {
  // CameraControls target follows a focused clash. Use it to avoid snapping
  // back to a stale authoring selection when the user starts orbiting.
  return getTarget();
}

function beginPan(e: PointerEvent): void {
  const cam = camera();
  const rect = ctx.rightHost.getBoundingClientRect();
  if (rect.height < 1) return;

  const target = getTarget();
  const dist = cam.position.distanceTo(target);
  const isOrtho = (cam as any).isOrthographicCamera;
  let worldPerPx: number;
  if (isOrtho) {
    // In ortho, world-per-pixel depends on the frustum height and the
    // current zoom factor: (top - bottom) / zoom / viewportHeight.
    const o = cam as THREE.OrthographicCamera;
    const z = Math.max(1e-3, o.zoom || 1);
    worldPerPx = ((o.top - o.bottom) / z) / rect.height;
  } else {
    const vFov = THREE.MathUtils.degToRad((cam as THREE.PerspectiveCamera).fov ?? 60);
    worldPerPx = (2 * Math.tan(vFov / 2) * Math.max(dist, 0.01)) / rect.height;
  }

  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);

  state = {
    kind: "pan",
    startX: e.clientX,
    startY: e.clientY,
    startTarget: target.clone(),
    startCam: cam.position.clone(),
    right,
    up,
    worldPerPx,
    fwd: cam.getWorldDirection(new THREE.Vector3()),
    fwdDist: Math.max(target.clone().sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3())), 1),
  };
}

function applyPan(dxTotal: number, dyTotal: number): void {
  if (state.kind !== "pan") return;
  const cam = camera();
  const c = controls();

  const offset = state.right
    .clone()
    .multiplyScalar(-dxTotal * state.worldPerPx)
    .add(state.up.clone().multiplyScalar(dyTotal * state.worldPerPx));

  const newPos = state.startCam.clone().add(offset);
  // Target straight ahead along the ORIGINAL view direction (pure translation).
  const newTarget = newPos.clone().addScaledVector(state.fwd, state.fwdDist);

  try {
    if (c && c.enabled === false) c.enabled = true;
  } catch { /* */ }

  try {
    c.setLookAt(newPos.x, newPos.y, newPos.z, newTarget.x, newTarget.y, newTarget.z, false);
    try { c.update?.(0); } catch { /* */ }
  } catch {
    cam.position.copy(newPos);
    try { cam.lookAt(newTarget); } catch { /* */ }
  }
  try { ctx.cam.updateClipping(); } catch { /* */ }
}

function beginOrbitSync(e: PointerEvent, pivot: THREE.Vector3): void {
  const cam = camera();
  const camToPivot = cam.position.clone().sub(pivot);
  const spherical = new THREE.Spherical().setFromVector3(camToPivot);
  const rect = ctx.rightHost.getBoundingClientRect();
  const pixelsToRadians = (Math.PI * 2) / Math.max(rect.height, 400);

  state = {
    kind: "orbit",
    startX: e.clientX,
    startY: e.clientY,
    pivot,
    startSpherical: spherical,
    pixelsToRadians,
  };
}

async function selectionCenter(): Promise<THREE.Vector3> {
  try {
    const box = await (ctx.features as any)?.selection?.boundingBox?.();
    if (box && !box.isEmpty()) return box.getCenter(new THREE.Vector3());
  } catch {
    /* */
  }
  const auth = (ctx.features as any)?.authoring;
  if (auth?.getSelectedIds?.()?.length) {
    const ids = auth.getSelectedIds() as string[];
    const b = new THREE.Box3();
    for (const id of ids) {
      const el = auth.getElementById?.(id);
      if (!el) continue;
      const wb = auth.getElementWorldBox?.(el);
      if (wb && !wb.isEmpty()) b.union(wb);
    }
    if (!b.isEmpty()) return b.getCenter(new THREE.Vector3());
  }
  return getTarget();
}

function applyOrbit(dxTotal: number, dyTotal: number): void {
  if (state.kind !== "orbit") return;
  const cam = camera();
  const c = controls();

  const sph = state.startSpherical.clone();
  sph.theta -= dxTotal * state.pixelsToRadians * 1.4;
  sph.phi -= dyTotal * state.pixelsToRadians * 1.4;
  sph.phi = THREE.MathUtils.clamp(sph.phi, 0.02, Math.PI - 0.02);

  // In ortho, the visible size is controlled by zoom, so any radius
  // works — but keep it close for stable near/far clipping.
  const isOrtho = (cam as any).isOrthographicCamera;
  if (isOrtho) {
    sph.radius = Math.max(sph.radius, __obsGetSceneRadiusFallback() * 1.5);
  }

  const newPos = state.pivot.clone().add(new THREE.Vector3().setFromSpherical(sph));

  try { if (c && c.enabled === false) c.enabled = true; } catch { /* */ }

  try {
    c.setLookAt(newPos.x, newPos.y, newPos.z, state.pivot.x, state.pivot.y, state.pivot.z, false);
    try { c.update?.(0); } catch { /* */ }
  } catch {
    cam.position.copy(newPos);
    cam.lookAt(state.pivot);
  }
  try { ctx.cam.updateClipping(); } catch { /* */ }
}

export function zoomAtCursor(
  deltaY: number,
  deltaMode: number,
  mods: Mods,
  focus: THREE.Vector3 | null,
): void {
  const modeScale = deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 16
    : deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
  const delta = THREE.MathUtils.clamp(deltaY * modeScale, -240, 240);
  const multiplier = mods.shift ? 2.5 : 1;
  const factor = Math.exp(delta * 0.0012 * multiplier);
  if (!Number.isFinite(factor) || factor <= 0) return;
  if (Math.abs(factor - 1) < 0.00001) return;
  zoomBy(factor, focus ?? undefined);
}

let overlay: HTMLDivElement | null = null;

function ensureOverlay(): HTMLDivElement {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "obs-nav-box";
  overlay.style.cssText =
    "position:absolute;pointer-events:none;z-index:70;display:none;" +
    "box-sizing:border-box;border-radius:1px";
  ctx.rightHost.appendChild(overlay);
  return overlay;
}

function renderBox(
  mode: "window" | "crossing",
  ax: number,
  ay: number,
  bx: number,
  by: number,
): void {
  const el = ensureOverlay();
  const x1 = Math.min(ax, bx);
  const y1 = Math.min(ay, by);
  const x2 = Math.max(ax, bx);
  const y2 = Math.max(ay, by);
  el.style.left = `${x1}px`;
  el.style.top = `${y1}px`;
  el.style.width = `${Math.max(1, x2 - x1)}px`;
  el.style.height = `${Math.max(1, y2 - y1)}px`;
  el.style.display = "block";
  if (mode === "window") {
    el.style.background = "rgba(56,189,248,0.14)";
    el.style.border = "1px solid #38bdf8";
  } else {
    el.style.background = "rgba(34,197,94,0.14)";
    el.style.border = "1px dashed #22c55e";
  }
}

function hideBox(): void {
  if (overlay) overlay.style.display = "none";
}

function attachModifierTracking(): void {
  window.addEventListener("keydown", onCameraKeyDown, true);
  window.addEventListener("keyup", onCameraKeyUp, true);
  window.addEventListener("blur", clearCameraMoveKeys);
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element?.closest?.("input,textarea,select,[contenteditable='true']");
}

function stopCameraMotion(): void {
  try { controls()?.stop?.(); } catch { /* */ }
}

function onCameraKeyDown(event: KeyboardEvent): void {
  if (isTypingTarget(event.target) || blocked()) return;
  const code = event.code;
  if (code === "KeyR" || code === "KeyF") {
    if (event.repeat) return;
    event.preventDefault();
    stopCameraMotion();
    fitAll();
    return;
  }
  if (!isCameraMoveKey(code)) return;
  event.preventDefault();
  cameraMoveKeys.add(code);
  stopCameraMotion();
  if (!cameraMoveFrame) {
    cameraMoveTime = performance.now();
    cameraMoveFrame = requestAnimationFrame(moveCameraFromKeys);
  }
}

function onCameraKeyUp(event: KeyboardEvent): void {
  cameraMoveKeys.delete(event.code);
  if (!cameraMoveKeys.size && cameraMoveFrame) {
    cancelAnimationFrame(cameraMoveFrame);
    cameraMoveFrame = 0;
  }
}

function isCameraMoveKey(code: string): boolean {
  return ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(code);
}

function clearCameraMoveKeys(): void {
  cameraMoveKeys.clear();
  if (cameraMoveFrame) cancelAnimationFrame(cameraMoveFrame);
  cameraMoveFrame = 0;
}

function moveCameraFromKeys(now: number): void {
  cameraMoveFrame = 0;
  if (!cameraMoveKeys.size || blocked()) return;
  const cam = camera();
  const target = getTarget();
  const direction = cam.getWorldDirection(new THREE.Vector3());
  direction.y = 0;
  if (direction.lengthSq() < 1e-6) direction.set(0, 0, -1);
  direction.normalize();
  const right = direction.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
  const movement = new THREE.Vector3();
  if (cameraMoveKeys.has("KeyW") || cameraMoveKeys.has("ArrowUp")) movement.add(direction);
  if (cameraMoveKeys.has("KeyS") || cameraMoveKeys.has("ArrowDown")) movement.sub(direction);
  if (cameraMoveKeys.has("KeyD") || cameraMoveKeys.has("ArrowRight")) movement.add(right);
  if (cameraMoveKeys.has("KeyA") || cameraMoveKeys.has("ArrowLeft")) movement.sub(right);
  if (movement.lengthSq() > 0) {
    const distance = cam.position.distanceTo(target);
    const dt = Math.min(Math.max((now - cameraMoveTime) / 1000, 0), 0.05);
    const step = Math.max(distance * 0.55, 1) * dt;
    movement.normalize().multiplyScalar(step);
    const position = cam.position.clone().add(movement);
    const nextTarget = target.clone().add(movement);
    try { controls().setLookAt(position.x, position.y, position.z, nextTarget.x, nextTarget.y, nextTarget.z, false); } catch {
      cam.position.copy(position);
      cam.lookAt(nextTarget);
    }
    try { ctx.cam.updateClipping(); } catch { /* */ }
  }
  cameraMoveTime = now;
  if (cameraMoveKeys.size) cameraMoveFrame = requestAnimationFrame(moveCameraFromKeys);
}

function isUiTarget(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  if (!t || !t.closest) return false;
  if (t.tagName === "CANVAS") return false;
  return !!t.closest(
    "input,select,textarea,button,label,a,[contenteditable]," +
      ".obs-bim-options,.obs-bim-contextual,.obs-bim-viewbar," +
      ".obs-plan-overlay,#obs-ai-chat,#obs-command-palette," +
      "[data-obs-panel],.obs-panel,.bb-status,.obs-toast-host",
  );
}

export function setupNavigation(): void {
  ensureOverlay();
  attachModifierTracking();
  disableNativeCameraMouse();
  try { forceResumeCameraControls(); } catch { /* */ }

  const safetyEnd = () => {
    endNavGesture();
  };
  window.addEventListener("pointercancel", safetyEnd, true);
  window.addEventListener("blur", safetyEnd);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) safetyEnd();
  });

  inputRouter.registerCancel(() => {
    if (state.kind === "idle") return false;
    endNavGesture();
    return true;
  });

  inputRouter.subscribe((g) => {
    const cameraDrag = (g.kind === "drag-start" || g.kind === "drag-move" || g.kind === "drag-end")
      && (g.button === 0 || g.button === 1 || g.button === 2);
    if (g.kind === "drag-start" && cameraDrag) {
      if (blocked() || isUiTarget(g.event)) return false;
      disableNativeCameraMouse();
      stopCameraMotion();
      try { forceResumeCameraControls(); } catch { /* */ }
      const pan = g.button === 2 || g.button === 1 || (g.button === 0 && g.mods.shift);
      if (pan) {
        beginPan(g.event);
        ctx.rightHost.style.cursor = "move";
      } else {
        beginOrbitSync(g.event, getOrbitPivot());
        ctx.rightHost.style.cursor = "grabbing";
      }
      return true;
    }

    if (g.kind === "drag-move" && cameraDrag) {
      if (state.kind === "pan") {
        applyPan(g.dx, g.dy);
        return true;
      }
      if (state.kind === "orbit") {
        applyOrbit(g.dx, g.dy);
        return true;
      }
      return false;
    }

    if (g.kind === "drag-end" && cameraDrag) {
      if (state.kind === "pan" || state.kind === "orbit") {
        endNavGesture();
        return true;
      }
      try { forceResumeCameraControls(); } catch { /* */ }
      return false;
    }

    if (g.kind === "drag-start" && g.button === 0) {
      if (blocked() || isUiTarget(g.event)) return false;
      const probe: Extract<Gesture, { kind: "drag-move" }> = {
        kind: "drag-move",
        button: 0,
        mods: g.mods,
        dx: 0,
        dy: 0,
        event: g.event,
      };
      for (const d of dragDelegates) {
        try {
          if (d(probe)) return false;
        } catch (err) {
          console.error("[navigation] drag delegate threw", err);
        }
      }
      state = {
        kind: "box-select",
        startX: g.event.clientX,
        startY: g.event.clientY,
        mode: "window",
      };
      ctx.rightHost.style.cursor = "crosshair";
      return true;
    }

    if (g.kind === "drag-move" && state.kind === "box-select") {
      for (const d of dragDelegates) {
        try {
          if (d(g)) {
            hideBox();
            state = { kind: "idle" };
            ctx.rightHost.style.cursor = "";
            return false;
          }
        } catch (err) {
          console.error("[navigation] drag delegate threw", err);
        }
      }
      const rect = ctx.rightHost.getBoundingClientRect();
      const mode: "window" | "crossing" =
        g.event.clientX >= (state as any).startX ? "window" : "crossing";
      (state as any).mode = mode;
      renderBox(
        mode,
        (state as any).startX - rect.left,
        (state as any).startY - rect.top,
        g.event.clientX - rect.left,
        g.event.clientY - rect.top,
      );
      return true;
    }

    if (g.kind === "drag-end" && g.button === 0 && state.kind === "box-select") {
      const rect = ctx.rightHost.getBoundingClientRect();
      const x1 = state.startX - rect.left;
      const y1 = state.startY - rect.top;
      const x2 = g.event.clientX - rect.left;
      const y2 = g.event.clientY - rect.top;
      hideBox();
      state = { kind: "idle" };
      try { ctx.rightHost.style.cursor = ""; } catch { /* */ }
      try { forceResumeCameraControls(); } catch { /* */ }

      if (Math.abs(x2 - x1) < 3 && Math.abs(y2 - y1) < 3) return false;

      const mode: "window" | "crossing" = x2 >= x1 ? "window" : "crossing";
      // Revit-style modifiers: Ctrl adds to the selection, Shift removes.
      const modifier: "replace" | "add" | "remove" =
        g.mods.ctrl || g.mods.meta ? "add" : g.mods.shift || g.mods.alt ? "remove" : "replace";
      void (ctx.features as any).boxSelection?.commit?.(
        {
          x1: Math.min(x1, x2),
          y1: Math.min(y1, y2),
          x2: Math.max(x1, x2),
          y2: Math.max(y1, y2),
        },
        mode,
        modifier,
      );
      return true;
    }

    if (g.kind === "click" && g.button === 0) {
      if (blocked()) return false;
      for (const d of clickDelegates) {
        try {
          if (d(g.mods, g.event)) return true;
        } catch (err) {
          console.error("[navigation] click delegate threw", err);
        }
      }
      return false;
    }

    if (g.kind === "wheel") {
      if ((window as any).__OBS_MMB_HELD) return true;
      if (blocked() || isUiTarget(g.event)) return false;
      const mods: Mods = g.mods ?? {
        ctrl: g.event.ctrlKey,
        shift: g.event.shiftKey,
        alt: g.event.altKey,
        meta: g.event.metaKey,
      };
      // openbim-fix: navigation.ts -- check wheel authority before raycasting
      if ((window as any).__OBS_WHEEL_AUTHORITY) return false;
      stopCameraMotion();
      const focus = pickWorldPointUnderCursor(g.event.clientX, g.event.clientY);
      zoomAtCursor(g.event.deltaY, g.event.deltaMode, mods, focus);
      // Wheel zoom counts as a gesture for the dblclick→fitAll cooldown.
      lastNavGestureAt = performance.now();
      return true;
    }

    if (g.kind === "dblclick" && g.button === 1) {
      if (blocked() || isUiTarget(g.event)) return false;
      // Suppress the dblclick → fitAll snap-back when the user has just
      // finished a camera gesture (pan/orbit/zoom). Without this cooldown,
      // a quick MMB release + re-click (within ~320ms, the input-router's
      // dblclick window) fires fitAll() and zooms the user out of the view
      // they just composed. The user perceives this as "the camera snaps
      // back to the old start view" — a high-friction UX bug.
      //
      // The cooldown is set on every drag-end and wheel zoom; it expires
      // after DOUBLE_CLICK_FIT_COOLDOWN_MS. After expiry, a genuine
      // double-MMB-click still fires fitAll (preserving the feature).
      if (performance.now() - lastNavGestureAt < DOUBLE_CLICK_FIT_COOLDOWN_MS) {
        return true; // swallow the dblclick without firing fitAll
      }
      fitAll();
      return true;
    }

    return false;
  }, 30);

  ctx.rightHost.addEventListener(
    "wheel",
    (e) => {
      if (!isUiTarget(e)) e.preventDefault();
    },
    { passive: false },
  );

  (ctx.features as any).navigation = {
    getState: () => state,
    whenBlocked: whenNavigationBlocked,
    onNavClick,
    onNavDrag,
  };

  console.log("[navigation] BIM-style navigation active");
}

export function getNavigationState(): NavState {
  return state;
}

export function cancelNavigationGesture(): void {
  state = { kind: "idle" };
  hideBox();
  try { ctx.rightHost.style.cursor = ""; } catch { /* */ }
  try { forceResumeCameraControls(); } catch { /* */ }
}

function disableNativeCameraMouse(): void {
  try {
    const c: any = controls();
    if (!c) return;
    const ACTION = c.constructor?.ACTION || (window as any).CameraControls?.ACTION;
    if (c.mouseButtons && ACTION) {
      c.mouseButtons.left = ACTION.NONE ?? 0;
      c.mouseButtons.middle = ACTION.NONE ?? 0;
      c.mouseButtons.right = ACTION.NONE ?? 0;
      c.mouseButtons.wheel = ACTION.NONE ?? 0;
    }
    if (c.touches && ACTION) {
      try {
        c.touches.one = ACTION.NONE ?? 0;
        c.touches.two = ACTION.NONE ?? 0;
        c.touches.three = ACTION.NONE ?? 0;
      } catch { /* */ }
    }
    /* dampingFactor deprecated; smoothTime is used instead */
    try { if ("draggingSmoothTime" in c) c.draggingSmoothTime = 0; } catch { /* */ }
    try { if ("azimuthRotateSpeed" in c) c.azimuthRotateSpeed = 1; } catch { /* */ }
    try { if ("polarRotateSpeed" in c) c.polarRotateSpeed = 1; } catch { /* */ }

    // CRITICAL: Lock mouseButtons.middle to ACTION.NONE via a property
    // getter so @thatopen/components' OrthoPerspectiveCamera cannot
    // re-enable it. OrthoPerspectiveCamera.setupOrthoCamera() and
    // setPerspectiveCamera() both set mouseButtons.middle = ACTION.ZOOM
    // or ACTION.DOLLY when switching projection modes, overriding our
    // ACTION.NONE. This causes camera-controls to process MMB drag as
    // its own dolly/zoom, competing with navigation.ts's pan and
    // causing the view to change unexpectedly.
    //
    // By making the property read-only (getter always returns 0 = NONE),
    // any subsequent assignment is silently ignored in non-strict mode
    // or throws in strict mode (which we catch). In both cases, the
    // value read by camera-controls' onPointerDown is always 0 = NONE.
    try {
      const NONE = ACTION?.NONE ?? 0;
      const mb = c.mouseButtons;
      if (mb && Object.getOwnPropertyDescriptor(mb, "middle")?.configurable !== false) {
        Object.defineProperty(mb, "middle", {
          get: () => NONE,
          set: () => { /* silently ignore — navigation.ts owns MMB */ },
          configurable: true,
        });
      }
    } catch { /* property may already be locked */ }
  } catch (e) {
    console.warn("[navigation] disableNativeCameraMouse", e);
  }
}

function endNavGesture(resetCursor = true): void {
  state = { kind: "idle" };
  hideBox();
  if (resetCursor) {
    try { ctx.rightHost.style.cursor = ""; } catch { /* */ }
  }
  try { forceResumeCameraControls(); } catch { /* */ }
  // Stamp the end of this gesture so the dblclick→fitAll handler can
  // suppress itself for a brief cooldown. Without this, releasing MMB
  // and quickly re-clicking fires fitAll() and snaps the camera back
  // to the whole-scene view, discarding the user's composed view.
  lastNavGestureAt = performance.now();
}

function __obsGetSceneRadiusFallback(): number {
  try {
    const c: any = (window as any).__OBS_CTX__;
    const box = c?.scene?.box;

    if (box && typeof box.isEmpty === "function" && !box.isEmpty()) {
      const min = box.min;
      const max = box.max;

      if (min && max) {
        const dx = Number(max.x) - Number(min.x);
        const dy = Number(max.y) - Number(min.y);
        const dz = Number(max.z) - Number(min.z);

        const r = Math.hypot(dx, dy, dz);

        if (Number.isFinite(r) && r > 0) {
          return r;
        }
      }
    }
  } catch {
    // Ignore and use fallback radius.
  }

  return 100;
}

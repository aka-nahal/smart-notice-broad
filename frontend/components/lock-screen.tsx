"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

/**
 * Full-screen lock overlay — a procedural 3D emoji built entirely with
 * three.js primitives. No external model, no image assets for the face.
 *
 *   - Head: sphere with a warm yellow MeshStandardMaterial
 *   - Eyes: white spheres w/ dark pupils that track the viewer
 *   - Alternate eyes: heart-shape extrusions (used when viewer is close)
 *   - Mouth: partial torus for smile/grin, sphere for "O" surprise
 *   - Cheeks: flat pink discs that fade in on blush states
 *
 * Two camera signals feed this component:
 *
 *  1. jeelizFaceExpressions (vendored under /public/jeeliz): runs a
 *     tiny neural net on the browser's webcam and hands us 11 morph
 *     coefficients (smile, open, eye-close, brow up/down, ...) and head
 *     yaw/pitch/roll each frame. When detected, we mirror those onto
 *     the emoji so its face moves with the viewer's.
 *
 *  2. /api/presence (rpicam detector on the backend): fallback source
 *     for face position + bbox area when the browser can't open a webcam
 *     (the Pi CSI camera is usually held by rpicam-vid). Also drives the
 *     "anyone there?" -> "hi there!" copy from distance.
 *
 * If both are available, jeeliz wins — it gives expressive mirroring the
 * bbox alone can't. The overlay lingers 5s after presence is detected
 * before fading out so the hand-off to notices isn't abrupt.
 */

// 11-slot morph array: [smileR, smileL, browLD, browRD, browLU, browRU,
//   mouthOpen, mouthRound, eyeRClose, eyeLClose, mouthNasty]
const M_SMILE_R    = 0
const M_SMILE_L    = 1
const M_BROW_UP_L  = 4
const M_BROW_UP_R  = 5
const M_MOUTH_OPEN = 6
const M_EYE_R_CLOSE = 8
const M_EYE_L_CLOSE = 9

type ExprKey = "smile" | "grin" | "surprise" | "love" | "wink" | "sleepy"

export function LockScreen({ visible }: { visible: boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(visible)

  // Shared viewer state: updated by face tracking / cursor; read by the
  // render loop each frame.
  const viewerRef = useRef<{
    present: boolean
    x: number; y: number
    area: number
    speed: number
  }>({ present: false, x: 0.5, y: 0.5, area: 0, speed: 0 })

  const [viewer, setViewer] = useState(viewerRef.current)
  const [justArrived, setJustArrived] = useState(false)

  // Jeeliz face-expression state, updated in its callbackTrack. Stored in a
  // ref so the three.js render loop can read the latest values without
  // re-subscribing on every update.
  const jeelizRef = useRef<{
    detected: boolean
    morphs: Float32Array | number[] | null
    rot: [number, number, number]   // rx (pitch), ry (yaw), rz (roll)
  }>({ detected: false, morphs: null, rot: [0, 0, 0] })

  // Linger 5s after presence detected before fading.
  useEffect(() => {
    if (visible) { setShown(true); return }
    const id = setTimeout(() => setShown(false), 5000)
    return () => clearTimeout(id)
  }, [visible])

  // Face tracking — poll /api/presence, which is fed by the server-side
  // rpicam detector (see presence_detector.py). The detector publishes the
  // largest detected face's bbox center + area in normalized frame coords,
  // and we smooth them with an EMA here so the pupils don't jitter.
  useEffect(() => {
    let cancelled = false
    let emaX = 0.5, emaY = 0.5, emaA = 0, lastX = 0.5, lastY = 0.5
    let prevPresent = false
    let lostAt = 0

    const tick = async () => {
      if (cancelled) return
      try {
        const res = await fetch("/api/presence", { cache: "no-store" })
        if (!res.ok) throw new Error(`status ${res.status}`)
        const data = await res.json() as {
          looking: boolean
          face: { x: number; y: number; area: number } | null
        }

        if (data.face) {
          const { x, y, area } = data.face
          emaX = emaX * 0.6 + x    * 0.4
          emaY = emaY * 0.6 + y    * 0.4
          emaA = emaA * 0.7 + area * 0.3
          const speed = Math.hypot(emaX - lastX, emaY - lastY)
          lastX = emaX; lastY = emaY
          viewerRef.current = { present: true, x: emaX, y: emaY, area: emaA, speed }
          setViewer(viewerRef.current)
          if (!prevPresent) {
            setJustArrived(true)
            setTimeout(() => setJustArrived(false), 1500)
          }
          prevPresent = true
          lostAt = 0
        } else {
          // No face in this frame — give it a short grace period before
          // flipping state. Haar misses occasional frames even with a
          // viewer present; the grace absorbs that blip without the eyes
          // going blank.
          if (!lostAt) lostAt = performance.now()
          if (performance.now() - lostAt > 800 && prevPresent) {
            prevPresent = false
            viewerRef.current = { ...viewerRef.current, present: false, area: 0, speed: 0 }
            setViewer(viewerRef.current)
          }
        }
      } catch {
        /* backend down / no network — leave last known state in place */
      }
    }

    tick()
    const id = setInterval(tick, 200)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Jeeliz face-expression tracker. Loads the vendored script (which
  // registers window.JEELIZFACEEXPRESSIONS) once, then inits the NN. On
  // each detected frame we stash the stabilized morphs + rotation into a
  // ref that the three.js render loop reads. If the browser can't open a
  // webcam (kiosk Pi where rpicam-vid owns the CSI camera), init fails
  // silently and we fall back to the /api/presence signal above.
  useEffect(() => {
    if (typeof window === "undefined") return
    let cancelled = false
    let prevDetected = false
    let destroyed = false

    const JFE = () => (window as any).JEELIZFACEEXPRESSIONS

    const loadScript = (): Promise<void> =>
      new Promise((resolve, reject) => {
        if (JFE()) return resolve()
        const existing = document.querySelector<HTMLScriptElement>(
          'script[data-jeeliz="face-expressions"]',
        )
        if (existing) {
          existing.addEventListener("load", () => resolve())
          existing.addEventListener("error", () => reject(new Error("script err")))
          return
        }
        const s = document.createElement("script")
        s.src = "/jeeliz/jeelizFaceExpressions.js"
        s.async = true
        s.dataset.jeeliz = "face-expressions"
        s.onload = () => resolve()
        s.onerror = () => reject(new Error("script err"))
        document.head.appendChild(s)
      })

    ;(async () => {
      try {
        await loadScript()
      } catch { return /* script failed to load */ }
      if (cancelled) return
      const api = JFE()
      if (!api || typeof api.init !== "function") return

      api.init({
        canvasId: "jeelizFaceExpressionsCanvas",
        NNCPath:  "/jeeliz/",
        callbackReady: (err: unknown) => {
          if (err) console.warn("jeeliz init error", err)
        },
        callbackTrack: () => {
          if (destroyed) return
          const detected = !!api.is_detected?.()
          if (detected) {
            const morphs = api.get_morphTargetInfluencesStabilized?.()
            const rot    = api.get_rotationStabilized?.()
            jeelizRef.current = {
              detected: true,
              morphs: morphs ?? null,
              rot: rot ? [rot[0], rot[1], rot[2]] : [0, 0, 0],
            }
            if (!prevDetected) {
              // New viewer arrived in the webcam frame.
              setJustArrived(true)
              setTimeout(() => setJustArrived(false), 1500)
              // Promote /api/presence-style "present" so the copy reacts
              // even if rpicam isn't publishing.
              viewerRef.current = { ...viewerRef.current, present: true }
              setViewer(viewerRef.current)
            }
            prevDetected = true
          } else {
            jeelizRef.current = { ...jeelizRef.current, detected: false }
            prevDetected = false
          }
        },
      })
    })()

    return () => {
      cancelled = true
      destroyed = true
      try { (window as any).JEELIZFACEEXPRESSIONS?.destroy?.() } catch { /* ignore */ }
    }
  }, [])

  // three.js scene.
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      35, mount.clientWidth / mount.clientHeight, 0.1, 2000,
    )
    camera.position.set(0, 0, 320)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    // Lighting — studio-ish with a warm key and cool violet fill so the
    // emoji reads as "cute toy" rather than "plastic ball".
    scene.add(new THREE.HemisphereLight(0xfff6e0, 0x221133, 0.9))
    const key = new THREE.DirectionalLight(0xfde68a, 1.6)
    key.position.set(200, 300, 300)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x8b5cf6, 0.9)
    fill.position.set(-200, 100, -100)
    scene.add(fill)
    const rim = new THREE.PointLight(0xec4899, 1.5, 800)
    rim.position.set(0, 200, -200)
    scene.add(rim)

    // Group that owns the whole emoji so we can tilt/bob it together.
    const emoji = new THREE.Group()
    scene.add(emoji)

    // --- Head ---
    const HEAD_R = 100
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(HEAD_R, 64, 64),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24, roughness: 0.35, metalness: 0.05,
        emissive: 0x92400e, emissiveIntensity: 0.15,
      }),
    )
    emoji.add(head)

    // --- Eye helpers ---
    // Eyes sit on the head surface, slightly above center, splayed left/right.
    const eyeOffset = new THREE.Vector3(28, 18, HEAD_R - 8)
    const eyeL = buildEye(+eyeOffset.x, eyeOffset.y, eyeOffset.z)
    const eyeR = buildEye(-eyeOffset.x, eyeOffset.y, eyeOffset.z)
    emoji.add(eyeL.group, eyeR.group)

    // --- Mouth variants. Toggle visibility instead of rebuilding. ---
    const mouthGroup = new THREE.Group()
    mouthGroup.position.set(0, -28, HEAD_R - 4)
    emoji.add(mouthGroup)

    // Smile: half-torus arc, opening upward.
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(22, 3.5, 16, 64, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4 }),
    )
    smile.rotation.z = Math.PI
    mouthGroup.add(smile)

    // Grin: wider arc + a red "inside" fill to suggest teeth/tongue.
    const grin = new THREE.Group()
    const grinArc = new THREE.Mesh(
      new THREE.TorusGeometry(30, 4, 16, 64, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4 }),
    )
    grinArc.rotation.z = Math.PI
    grin.add(grinArc)
    const grinFill = new THREE.Mesh(
      new THREE.SphereGeometry(24, 32, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xbe123c, roughness: 0.5 }),
    )
    grinFill.position.y = -4
    grin.add(grinFill)
    grin.visible = false
    mouthGroup.add(grin)

    // O-surprise: small dark disc.
    const oMouth = new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 }),
    )
    oMouth.scale.set(1, 1.15, 0.4)
    oMouth.visible = false
    mouthGroup.add(oMouth)

    // --- Cheek blush: flat pink discs, toggled on blush expressions ---
    const cheekMat = new THREE.MeshBasicMaterial({
      color: 0xfb7185, transparent: true, opacity: 0.55,
    })
    const cheekL = new THREE.Mesh(new THREE.CircleGeometry(16, 24), cheekMat)
    const cheekR = new THREE.Mesh(new THREE.CircleGeometry(16, 24), cheekMat.clone())
    cheekL.position.set(+52, -14, HEAD_R - 2)
    cheekR.position.set(-52, -14, HEAD_R - 2)
    emoji.add(cheekL, cheekR)

    // --- State ---
    let expr: ExprKey = "smile"
    let blinking = false
    let blinkT = 0
    let scheduleBlink = performance.now() + 2500 + Math.random() * 2000

    const setExpression = (next: ExprKey) => {
      if (next === expr) return
      expr = next
      // Mouth
      smile.visible   = next === "smile" || next === "love" || next === "wink" || next === "sleepy"
      grin.visible    = next === "grin"
      oMouth.visible  = next === "surprise"
      // Cheeks fade in on blush states.
      const blush = next === "smile" || next === "grin" || next === "love" || next === "wink"
      ;(cheekL.material as THREE.MeshBasicMaterial).opacity = blush ? 0.55 : 0
      ;(cheekR.material as THREE.MeshBasicMaterial).opacity = blush ? 0.55 : 0
      // Pupils: hearts on "love", tiny/forward on others.
      eyeL.setHeart(next === "love")
      eyeR.setHeart(next === "love")
    }

    const clock = new THREE.Clock()
    let raf = 0
    let yaw = 0, pitch = 0
    let disposed = false

    const render = () => {
      if (disposed) return
      raf = requestAnimationFrame(render)
      const dt = clock.getDelta()
      const t  = performance.now()

      const v = viewerRef.current
      const j = jeelizRef.current

      // --- Head pose ---
      if (j.detected) {
        // Mirror the viewer's head rotation. Signs/scales picked so that
        // tilting your head right rolls the emoji the same way on screen.
        const [rx, ry, rz] = j.rot
        const targetPitch = -rx * 0.9
        const targetYaw   = -ry * 0.9
        const targetRoll  =  rz * 0.9
        pitch += (targetPitch - pitch) * Math.min(1, dt * 10)
        yaw   += (targetYaw   - yaw)   * Math.min(1, dt * 10)
        emoji.rotation.set(pitch, yaw, targetRoll)
      } else {
        // Fall back to bbox-center from /api/presence.
        const targetYaw   = (v.x - 0.5) * 0.9
        const targetPitch = (v.y - 0.5) * 0.5
        yaw   += (targetYaw   - yaw)   * Math.min(1, dt * 6)
        pitch += (targetPitch - pitch) * Math.min(1, dt * 6)
        emoji.rotation.set(pitch, yaw, 0)
      }

      // --- Pupils ---
      // When jeeliz is driving head pose, fix pupils centered (head moves
      // instead). When only rpicam bbox is available, offset pupils so the
      // face still "looks" at the viewer despite static head.
      if (j.detected) {
        eyeL.setPupilOffset(0, 0)
        eyeR.setPupilOffset(0, 0)
      } else {
        const ndx = (v.x - 0.5) * 2
        const ndy = (v.y - 0.5) * 2
        const len = Math.hypot(ndx, ndy) || 1
        const c   = Math.min(len, 1)
        const px  = (ndx / len) * c * 5.5
        const py  = (ndy / len) * c * 5.5
        eyeL.setPupilOffset(px, -py)
        eyeR.setPupilOffset(px, -py)
      }

      // Idle bob + tiny wobble.
      emoji.position.y = Math.sin(t / 600) * 3
      emoji.scale.setScalar(1 + Math.sin(t / 500) * 0.01)

      // --- Eyes (blink / mirror) ---
      if (j.detected && j.morphs) {
        // Mirror the user's actual eye-close amount per eye. Morphs are
        // 0..1, and jeeliz's "right" is the viewer's right (= mirrored on
        // screen); we flip so the emoji's left eye closes when the viewer
        // closes their on-screen-left eye.
        const lClose = j.morphs[M_EYE_L_CLOSE] ?? 0
        const rClose = j.morphs[M_EYE_R_CLOSE] ?? 0
        eyeL.setLidScale(Math.max(0.08, 1 - lClose))
        eyeR.setLidScale(Math.max(0.08, 1 - rClose))
      } else {
        // Scripted blink + wink when we don't have real eyelid data.
        if (!blinking && t >= scheduleBlink) { blinking = true; blinkT = 0 }
        if (blinking) {
          blinkT += dt
          const s = 1 - Math.sin(Math.min(blinkT / 0.16, 1) * Math.PI)
          eyeL.setLidScale(Math.max(0.1, s))
          eyeR.setLidScale(expr === "wink" ? 0.1 : Math.max(0.1, s))
          if (blinkT >= 0.16) {
            blinking = false
            eyeL.setLidScale(1)
            eyeR.setLidScale(expr === "wink" ? 0.1 : 1)
            scheduleBlink = t + 2500 + Math.random() * 2500
          }
        } else if (expr === "wink")   { eyeR.setLidScale(0.1) }
        else if (expr === "sleepy") { eyeL.setLidScale(0.35); eyeR.setLidScale(0.35) }
      }

      // --- Expression / mouth ---
      if (j.detected && j.morphs) {
        const smileAmt = ((j.morphs[M_SMILE_L] ?? 0) + (j.morphs[M_SMILE_R] ?? 0)) * 0.5
        const openAmt  = j.morphs[M_MOUTH_OPEN] ?? 0
        const browUp   = ((j.morphs[M_BROW_UP_L] ?? 0) + (j.morphs[M_BROW_UP_R] ?? 0)) * 0.5

        if (openAmt > 0.35 || browUp > 0.5) {
          setExpression("surprise")
          oMouth.scale.set(1, 1 + openAmt * 1.4, 0.4 + openAmt * 0.8)
        } else if (smileAmt > 0.45) {
          setExpression("grin")
        } else {
          setExpression("smile")
          // Scale the smile slightly with smile intensity so small smiles
          // read as smaller arcs — feels more responsive than a binary
          // smile/grin switch.
          smile.scale.set(1 + smileAmt * 0.4, 1 + smileAmt * 0.6, 1)
        }
      } else {
        // Reactive scripted expressions driven by rpicam presence.
        if (!v.present) {
          setExpression(t % 8000 < 4000 ? "sleepy" : "smile")
        } else if (v.area > 0.14) setExpression("love")
        else if  (v.speed > 0.05) setExpression("surprise")
        else if  (v.area > 0.07)  setExpression("grin")
        else if  (Math.floor(t / 5000) % 4 === 3) setExpression("wink")
        else setExpression("smile")
        smile.scale.set(1, 1, 1)
      }

      renderer.render(scene, camera)
    }
    render()

    const onResize = () => {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener("resize", onResize)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh
        m.geometry?.dispose?.()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose?.()
      })
    }
  }, [])

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[9999] overflow-hidden bg-black transition-opacity duration-700 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!shown}
    >
      {/* Neon backdrop */}
      <div
        className="absolute inset-0 animate-ls-hue opacity-70"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(56,189,248,0.45), transparent 55%),"
            + "radial-gradient(circle at 70% 70%, rgba(168,85,247,0.45), transparent 55%),"
            + "radial-gradient(circle at 50% 90%, rgba(236,72,153,0.35), transparent 60%)",
        }}
      />

      {/* WebGL canvas */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Jeeliz internal canvas — it requires a DOM element at this id to
          attach its GL context. We hide it: its output is not a visible
          render, just the substrate the NN runs on. Kept 1x1 to avoid any
          reflow cost. */}
      <canvas
        id="jeelizFaceExpressionsCanvas"
        width={1}
        height={1}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />

      {/* Instruction */}
      <div className="absolute inset-x-0 bottom-[6vh] flex flex-col items-center gap-2 text-center">
        <p
          className="text-[4vmin] font-black uppercase tracking-[0.4em] animate-ls-pulse-text"
          style={{
            background: "linear-gradient(90deg,#60a5fa,#c084fc,#f472b6,#fbbf24,#60a5fa)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {pickHeadline(viewer, justArrived)}
        </p>
        <p className="text-[2vmin] uppercase tracking-[0.5em] text-white/70">
          {pickSubline(viewer, justArrived)}
        </p>
      </div>

      <style>{`
        @keyframes ls-hue { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
        @keyframes ls-pulse-text {
          0%,100% { background-position:   0% 50%; transform: scale(1); }
          50%     { background-position: 200% 50%; transform: scale(1.04); }
        }
        .animate-ls-hue        { animation: ls-hue 20s linear infinite; }
        .animate-ls-pulse-text { animation: ls-pulse-text 2.4s ease-in-out infinite; }
      `}</style>
    </div>
  )
}

/**
 * Build one eye: white sclera sphere plus a swappable pupil (dark disc or
 * extruded heart). Returns helpers for offset/blink/heart toggling.
 */
type ViewerState = {
  present: boolean
  x: number; y: number
  area: number
  speed: number
}

/**
 * Headline copy reacts to presence + distance. `area` is the fraction of the
 * webcam frame the face takes up, so larger = closer. The thresholds are
 * rough — tuned so typical standing distance (~2m) shows "a little closer"
 * and arm's length shows "hi there!".
 */
function pickHeadline(v: ViewerState, justArrived: boolean): string {
  if (!v.present)      return "anyone there?"
  if (justArrived)     return "i see you!"
  if (v.area > 0.26)   return "whoa, too close!"
  if (v.area > 0.14)   return "hi there!"
  if (v.area > 0.08)   return "almost there"
  if (v.area > 0.04)   return "keep coming"
  if (v.area > 0.02)   return "you're far"
  return "too far away"
}

function pickSubline(v: ViewerState, justArrived: boolean): string {
  if (!v.present)      return "step in front of the board"
  if (justArrived)     return "stay a moment"
  if (v.area > 0.26)   return "take a step back"
  if (v.area > 0.14)   return "ready for notices"
  if (v.area > 0.08)   return "a couple more steps"
  if (v.area > 0.04)   return "keep walking closer"
  return "come closer to view notices"
}

function buildEye(x: number, y: number, z: number) {
  const group = new THREE.Group()
  group.position.set(x, y, z)

  // Sclera (eye white)
  const white = new THREE.Mesh(
    new THREE.SphereGeometry(18, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
  )
  group.add(white)

  // Pupil holder — moves laterally based on viewer position.
  const pupilHolder = new THREE.Group()
  pupilHolder.position.z = 10
  group.add(pupilHolder)

  const darkPupil = new THREE.Mesh(
    new THREE.SphereGeometry(9, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3 }),
  )
  // Tiny specular highlight.
  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  )
  shine.position.set(-3, 3, 7)
  darkPupil.add(shine)
  pupilHolder.add(darkPupil)

  // Heart pupil (hidden by default).
  const heart = buildHeartMesh()
  heart.scale.setScalar(6)
  heart.visible = false
  pupilHolder.add(heart)

  return {
    group,
    setPupilOffset(px: number, py: number) {
      pupilHolder.position.x = px
      pupilHolder.position.y = py
    },
    setLidScale(s: number) {
      // Scale Y of the whole eye group to simulate a blink/wink without
      // disappearing the geometry entirely.
      group.scale.y = s
    },
    setHeart(on: boolean) {
      darkPupil.visible = !on
      heart.visible = on
    },
  }
}

/**
 * Heart mesh, centered roughly at origin, facing +Z.
 * Built with THREE.Shape + ExtrudeGeometry, then normalized so the result
 * is small enough to be scaled by the caller.
 */
function buildHeartMesh(): THREE.Mesh {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0.5)
  shape.bezierCurveTo( 0.5,  1.2,  1.5,  0.8,  0,  -0.8)
  shape.moveTo(0, 0.5)
  shape.bezierCurveTo(-0.5,  1.2, -1.5,  0.8,  0,  -0.8)
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.4, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2,
  })
  geom.center()
  geom.rotateZ(Math.PI) // flip so the point faces down
  const mat = new THREE.MeshStandardMaterial({
    color: 0xef4444, roughness: 0.3, emissive: 0x7f1d1d, emissiveIntensity: 0.2,
  })
  return new THREE.Mesh(geom, mat)
}

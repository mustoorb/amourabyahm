// Memory Corridor — the home gallery.
//
// You glide forward through floating photographs and films in warm dark space.
// Each featured story contributes a cover frame plus a couple of "moments" (a photo,
// a film). The frame you arrive at snaps sharp and bright; everything else sits
// softly out of focus, dimmer and desaturated. Films start playing (muted) when you
// stop in front of them. Clicking any frame opens its story with a shared-element
// morph into the story page hero.
//
// Rendering is a single fullscreen Three.js scene; every frame is one quad with a
// custom shader doing cover-fit, rounded corners, fake depth-of-field (mip bias),
// periphery dim/desaturate and a consistent warm grade.

import * as THREE from 'three';

/** Feel knobs. Tweak freely — everything else derives from these. */
export const KNOBS = {
  fov: 42,
  viewDist: 4.2, // camera stands this far in front of the frame it's looking at
  gapStory: 7.8, // z-distance into the next story
  gapMoment: 5.4, // z-distance between frames of the same story
  coverScale: 0.64, // cover height as a fraction of the visible height at viewDist
  coverScaleMobile: 0.5,
  mobileLift: 0.12, // on phones, frames sit higher so the caption has room (fraction of visible height)
  momentScale: 0.5, // other frames, same measure
  maxWidthDesktop: 0.56, // cap frame width as a fraction of visible width
  maxWidthMobile: 0.84,
  sideSpread: 0.19, // how far frames alternate left/right (fraction of visible width)
  sideSpreadMobile: 0.07,
  centerAmount: 0.78, // how much the camera recentres on the frame it arrives at
  aspectMin: 0.62,
  aspectMax: 1.62,
  damping: 0.075, // camera easing towards its target (per 60fps frame)
  inertia: 0.9, // drag-release velocity decay (per 60fps frame)
  dragSpeed: 0.0042, // stops per pixel dragged
  wheelSpeed: 0.0016, // stops per wheel pixel
  snapDelay: 170, // ms of stillness before the magnetic snap
  nudge: 0.1, // gesture size (in stops) that commits to the next frame
  fogNear: 15,
  fogFar: 36,
  blurPerUnit: 0.9, // mip bias per unit away from focus
  blurMax: 5,
  moments: { desktop: 2, mobile: 1 }, // extra frames per story besides the cover
  texWindow: 6, // load textures this many stops around the camera; free beyond +4
  critical: 4, // stops that must load before the loader lifts
  parallax: 0.045, // pointer-driven camera look (radians)
  dust: 520, // ambient particles (desktop; mobile uses 40%)
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const damp = (k, dt) => 1 - Math.pow(1 - k, dt * 60);

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAME_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uTexOn;
  uniform vec2 uPlane;
  uniform float uImgAspect;
  uniform float uBlur;
  uniform float uFocus;
  uniform float uAlpha;
  uniform float uHover;
  uniform float uFilm;
  uniform float uFilmOn;
  varying vec2 vUv;

  float sdRound(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  float sdTri(vec2 p, float r) {
    const float k = sqrt(3.0);
    p.x = abs(p.x) - r;
    p.y = p.y + r / k;
    if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    p.x -= clamp(p.x, -2.0 * r, 0.0);
    return -length(p) * sign(p.y);
  }

  void main() {
    vec2 p = (vUv - 0.5) * uPlane;
    float radius = 0.018 * max(uPlane.x, uPlane.y);
    float d = sdRound(p, uPlane * 0.5, radius);
    float aa = fwidth(d);
    float mask = 1.0 - smoothstep(-aa, aa, d);

    // cover-fit
    vec2 uv = vUv - 0.5;
    float r = (uPlane.x / uPlane.y) / uImgAspect;
    if (r < 1.0) uv.x *= r; else uv.y /= r;
    uv *= 1.0 - 0.035 * uHover;
    uv += 0.5;

    vec3 c = texture2D(uTex, uv, uBlur).rgb;
    c = mix(vec3(0.115, 0.1, 0.09), c, uTexOn);

    // consistent warm grade
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, 0.9);
    c = pow(max(c, 0.0), vec3(0.97, 1.0, 1.07));
    c *= vec3(1.045, 1.0, 0.92);
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.2);
    c += vec3(0.022, 0.014, 0.008) * (1.0 - l);

    // cinematic depth focus: periphery dims and desaturates
    float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l2), c, mix(0.25, 1.0, uFocus));
    c *= mix(0.34, 1.0, uFocus);

    // soft inner vignette
    vec2 q = vUv - 0.5;
    c *= 1.0 - dot(q, q) * 0.55;

    // film glyph
    if (uFilm > 0.5) {
      float m = min(uPlane.x, uPlane.y);
      float ring = abs(length(p) - 0.13 * m) - 0.004 * m;
      float tri = sdTri(vec2(-p.y, p.x - 0.012 * m), 0.042 * m);
      float g = (1.0 - smoothstep(-aa, aa, ring)) + (1.0 - smoothstep(-aa, aa, tri));
      c = mix(c, vec3(0.93, 0.89, 0.85), clamp(g, 0.0, 1.0) * 0.85 * (1.0 - uFilmOn));
    }

    gl_FragColor = vec4(c, mask * uAlpha);
  }
`;

const GLOW_FRAG = /* glsl */ `
  uniform vec2 uPlane;
  uniform vec2 uInner;
  uniform float uGlow;
  uniform vec3 uColor;
  varying vec2 vUv;
  float sdRound(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 p = (vUv - 0.5) * uPlane;
    float d = sdRound(p, uInner * 0.5, 0.02 * max(uInner.x, uInner.y));
    float g = exp(-max(d, 0.0) * 9.0) * step(0.0, d);
    // non-premultiplied output: additive blending multiplies by alpha, keeping the canvas transparent
    gl_FragColor = vec4(uColor, clamp(g * uGlow, 0.0, 1.0));
  }
`;

const DUST_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPx;
  varying float vA;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.12 + aSeed * 40.0) * 0.25;
    p.y += cos(uTime * 0.09 + aSeed * 23.0) * 0.25;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    vA = smoothstep(0.5, 3.0, dist) * (1.0 - smoothstep(12.0, 30.0, dist)) * (0.35 + 0.65 * fract(aSeed * 13.7));
    gl_PointSize = uPx * (0.6 + fract(aSeed * 7.3) * 1.6) * (6.0 / max(dist, 0.5));
    gl_Position = projectionMatrix * mv;
  }
`;
const DUST_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA * uOpacity;
    gl_FragColor = vec4(vec3(0.95, 0.82, 0.7), a);
  }
`;

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

/** Picks the extra frames for a story: photos first, then its first film. */
function pickMoments(story, n) {
  if (n <= 0) return [];
  const film = story.media.find((m) => m.type === 'video');
  const photos = story.media.filter((m) => m.type === 'image' && m.full !== story.cover);
  const out = photos.slice(0, film ? n - 1 : n);
  if (film) out.push(film);
  return out;
}

/** Placeholder texture for missing/blocked images: warm gradient + serif title. */
function placeholderTexture(title, aspect) {
  const h = 512;
  const w = Math.round(h * aspect);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#2a211d');
  grad.addColorStop(1, '#141010');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(236,228,218,.8)';
  g.font = `italic 300 ${Math.round(h * 0.09)}px "Cormorant Garamond", Georgia, serif`;
  g.textAlign = 'center';
  g.fillText(title, w / 2, h * 0.53);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/**
 * Mounts the corridor.
 * @param {HTMLElement} root   container (.corridor) holding the canvas host + overlays
 * @param {object} opts
 * @param {Array} opts.stories featured stories, newest first
 * @param {(slug:string, ctx:{rect:DOMRect|null, src:string}) => void} opts.onOpen
 * @param {(p:number) => void} [opts.onProgress] critical-texture progress 0..1
 * @param {(state:object) => void} [opts.onChange] stop/story focus changes
 * @param {(hovered:boolean) => void} [opts.onHover]
 * @param {number} [opts.startAt] initial stop position
 * @param {boolean} [opts.reducedMotion]
 */
export function mountCorridor(root, opts) {
  if (!supportsWebGL()) return null;

  const K = { ...KNOBS, ...(opts.knobs || {}) };
  const reduced = !!opts.reducedMotion;
  // Scroll-driven mode: the page's own scrolling moves you through the corridor
  // (via setScrollT). Wheel/drag/keys are left to the page; clicks still open stories.
  const scrollDriven = !!opts.scrollDriven;
  const mobileQuery = window.matchMedia('(max-width: 760px)');
  let isMobile = mobileQuery.matches;
  const saveData = !!navigator.connection?.saveData;

  const host = root.querySelector('[data-corridor-canvas]');
  const filmLayer = root.querySelector('[data-corridor-films]');
  const newBadge = root.querySelector('[data-corridor-new]');

  // ---------- renderer / scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  host.append(renderer.domElement);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(K.fov, 1, 0.05, 80);
  const quad = new THREE.PlaneGeometry(1, 1);

  // ---------- stops ----------
  const stories = opts.stories;
  const stops = [];
  function buildStops() {
    const nMoments = isMobile ? K.moments.mobile : K.moments.desktop;
    let z = 0;
    stories.forEach((story, si) => {
      const items = [{ kind: 'cover' }, ...pickMoments(story, nMoments).map((m) => ({ kind: m.type === 'video' ? 'film' : 'photo', media: m }))];
      items.forEach((it, k) => {
        if (stops.length) z -= k === 0 ? K.gapStory : K.gapMoment;
        const isCover = it.kind === 'cover';
        const aspect = it.kind === 'film' ? 16 / 9 : clamp(isCover ? story.coverAspect || 0.75 : it.media.aspect || 0.75, K.aspectMin, K.aspectMax);
        const url = isCover
          ? isMobile ? story.coverSm || story.cover : story.cover
          : it.kind === 'film'
            ? it.media.poster
            : isMobile ? it.media.thumb : it.media.full;
        stops.push({
          i: stops.length,
          kind: it.kind,
          story,
          storyIndex: si,
          media: it.media || null,
          url,
          aspect,
          z,
          x: 0,
          y: 0,
          seed: Math.sin((stops.length + 1) * 12.9898) * 0.5 + 0.5,
          tex: null,
          texState: 'none',
          texOn: 0,
          critical: stops.length < K.critical,
          reveal: 0,
          revealAt: Infinity,
          hover: 0,
          alpha: 0,
          filmOn: 0,
        });
      });
    });
  }
  buildStops();

  const firstStopOfStory = stories.map((_, si) => stops.findIndex((s) => s.storyIndex === si));
  const lastIndex = stops.length - 1;
  const endT = scrollDriven ? lastIndex : lastIndex + 0.62; // overshoot past the last frame → "see the archive"

  for (const s of stops) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAME_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTex: { value: null },
        uTexOn: { value: 0 },
        uPlane: { value: new THREE.Vector2(1, 1) },
        uImgAspect: { value: s.aspect },
        uBlur: { value: 0 },
        uFocus: { value: 0 },
        uAlpha: { value: 0 },
        uHover: { value: 0 },
        uFilm: { value: s.kind === 'film' ? 1 : 0 },
        uFilmOn: { value: 0 },
      },
    });
    s.mat = mat;
    s.mesh = new THREE.Mesh(quad, mat);
    s.mesh.userData.stop = s;
    s.mesh.visible = false;
    scene.add(s.mesh);

    const glowMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: GLOW_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPlane: { value: new THREE.Vector2(1, 1) },
        uInner: { value: new THREE.Vector2(1, 1) },
        uGlow: { value: 0 },
        uColor: { value: new THREE.Color(s.storyIndex === 0 ? 0xd9a3a0 : 0xd8b88a) },
      },
    });
    s.glow = new THREE.Mesh(quad, glowMat);
    s.glow.visible = false;
    s.glow.renderOrder = -1;
    scene.add(s.glow);
  }

  // ---------- dust ----------
  const dustCount = Math.round(K.dust * (isMobile ? 0.4 : 1));
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  const depth = Math.abs(stops[lastIndex].z) + 40;
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 14;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
    dustPos[i * 3 + 2] = 6 - Math.random() * depth;
    dustSeed[i] = Math.random();
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: DUST_VERT,
    fragmentShader: DUST_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 2 }, uOpacity: { value: 0 } },
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------- layout ----------
  let vw = 1, vh = 1, visW = 1, visH = 1;
  function layout() {
    vw = host.clientWidth || window.innerWidth;
    vh = host.clientHeight || window.innerHeight;
    isMobile = mobileQuery.matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.fov = isMobile ? K.fov + 8 : K.fov;
    camera.updateProjectionMatrix();
    visH = 2 * K.viewDist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    visW = visH * camera.aspect;
    const spread = visW * (isMobile ? K.sideSpreadMobile : K.sideSpread);
    const maxW = visW * (isMobile ? K.maxWidthMobile : K.maxWidthDesktop);
    for (const s of stops) {
      let h = visH * (s.kind === 'cover' ? (isMobile ? K.coverScaleMobile : K.coverScale) : K.momentScale);
      let w = h * s.aspect;
      if (w > maxW) {
        w = maxW;
        h = w / s.aspect;
      }
      s.w = w;
      s.h = h;
      const side = s.i === 0 ? 0 : s.i % 2 ? 1 : -1;
      s.x = side * spread * (0.8 + s.seed * 0.5);
      s.y = (s.seed - 0.5) * visH * (s.kind === 'cover' ? 0.05 : 0.14);
      s.mat.uniforms.uPlane.value.set(w, h);
      const pad = Math.min(w, h) * 0.5;
      s.glow.scale.set(w + pad, h + pad, 1);
      s.glow.material.uniforms.uPlane.value.set(w + pad, h + pad);
      s.glow.material.uniforms.uInner.value.set(w, h);
    }
    dustMat.uniforms.uPx.value = (isMobile ? 2.2 : 2.6) * renderer.getPixelRatio();
  }

  // ---------- camera path ----------
  let t = clamp(opts.startAt ?? 0, 0, lastIndex);
  let target = t;
  let vel = 0;
  const cam = { x: 0, y: 0, z: 0 };
  function pathAt(pos) {
    if (pos >= lastIndex) {
      const s = stops[lastIndex];
      return { x: s.x * K.centerAmount, y: s.y * 0.8, z: s.z - (pos - lastIndex) * K.gapStory * 0.6 };
    }
    const i0 = Math.floor(pos);
    const f = pos - i0;
    const a = stops[i0];
    const b = stops[i0 + 1];
    const e = f * f * (3 - 2 * f);
    return {
      x: (a.x + (b.x - a.x) * e) * K.centerAmount,
      y: (a.y + (b.y - a.y) * e) * 0.8,
      z: a.z + (b.z - a.z) * f,
    };
  }

  // ---------- textures ----------
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  let criticalTotal = Math.min(K.critical, stops.length);
  let criticalDone = 0;
  let readyResolve;
  const ready = new Promise((r) => (readyResolve = r));
  const bumpCritical = (s) => {
    if (!s.critical) return;
    s.critical = false;
    criticalDone++;
    opts.onProgress?.(criticalDone / criticalTotal);
    if (criticalDone >= criticalTotal) readyResolve();
  };
  if (!criticalTotal) readyResolve();

  function applyTexture(s, tex) {
    tex.colorSpace = THREE.NoColorSpace;
    tex.anisotropy = maxAniso;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    s.tex = tex;
    s.texState = 'ready';
    s.mat.uniforms.uTex.value = tex;
    const img = tex.image;
    if (img?.width && img?.height) s.mat.uniforms.uImgAspect.value = img.width / img.height;
  }

  function loadTexture(s) {
    s.texState = 'loading';
    const fail = () => {
      if (disposed) return;
      applyTexture(s, placeholderTexture(s.story.title, s.aspect));
      bumpCritical(s);
    };
    if (!s.url) return fail();
    loader.load(
      s.url,
      (tex) => {
        if (disposed || s.texState !== 'loading') return tex.dispose();
        applyTexture(s, tex);
        renderer.initTexture(tex);
        bumpCritical(s);
      },
      undefined,
      fail,
    );
  }

  function manageTextures() {
    for (const s of stops) {
      const d = Math.abs(s.i - t);
      if (d <= K.texWindow && s.texState === 'none') loadTexture(s);
      else if (d > K.texWindow + 4 && s.texState === 'ready') {
        s.tex.dispose();
        s.tex = null;
        s.texState = 'none';
        s.texOn = 0;
        s.mat.uniforms.uTex.value = null;
      }
    }
  }
  // Critical stops load in order first, so the loader measures what you'll see first.
  for (let i = 0; i < criticalTotal; i++) {
    const s = stops[clamp(Math.round(t) + i, 0, lastIndex)];
    if (s.texState === 'none') loadTexture(s);
    else bumpCritical(s);
  }
  // If we started mid-corridor, anything still flagged critical shouldn't block.
  stops.forEach((s) => {
    if (s.critical && s.texState === 'none') bumpCritical(s);
  });

  // ---------- input ----------
  const pointer = { x: 0, y: 0, nx: 0, ny: 0, inside: false };
  const look = { x: 0, y: 0 };
  let lastInput = 0;
  let drag = null;
  let hovered = null;
  let revealed = false;
  let interacted = false;

  let anchor = Math.round(t); // stop the current gesture started from
  const markInput = () => {
    const now = performance.now();
    if (now - lastInput > K.snapDelay && !drag?.touch) anchor = Math.round(t);
    lastInput = now;
    if (!interacted) {
      interacted = true;
      opts.onFirstInteraction?.();
    }
  };
  const clampTarget = () => (target = clamp(target, -0.25, endT));

  function onWheel(e) {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1;
    const d = (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
    target += clamp(d, -240, 240) * K.wheelSpeed;
    vel = 0;
    clampTarget();
    markInput();
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const touch = e.pointerType !== 'mouse';
    if (scrollDriven) {
      // only track the press so a tap/click can open a story; scrolling belongs to the page
      drag = { id: e.pointerId, touch, x: e.clientX, y: e.clientY, moved: 0, scroll: true };
      if (touch) pointer.inside = false;
      return;
    }
    drag = { id: e.pointerId, touch, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0, v: 0 };
    vel = 0;
    if (touch) {
      // Each swipe is measured from the frame you're heading to, so quick
      // successive swipes keep stepping forward.
      anchor = Math.round(target);
      pointer.inside = false;
    }
    try {
      renderer.domElement.setPointerCapture(e.pointerId);
    } catch {}
  }
  function onPointerMove(e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.nx = (e.clientX / vw) * 2 - 1;
    pointer.ny = -(e.clientY / vh) * 2 + 1;
    // Hover (glow, cursor label) is a mouse thing; on touch it would stick after lifting.
    pointer.inside = e.pointerType === 'mouse';
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.scroll) return;
    // Drag up / left moves you forward.
    const d = -(dy + dx * 0.7) * K.dragSpeed * (isMobile ? 1.6 : 1);
    target += d;
    clampTarget();
    const now = performance.now();
    const dt = Math.max(1, now - drag.t);
    drag.v = drag.v * 0.6 + (d / dt) * 16.7 * 0.4;
    drag.t = now;
    if (drag.moved > 6) {
      opts.onDrag?.(true);
      markInput();
    }
  }
  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.scroll) {
      const click = e.type === 'pointerup' && drag.moved < 7;
      drag = null;
      if (click) {
        const hit = pick(e.clientX, e.clientY);
        if (hit) open(hit);
      }
      return;
    }
    const wasClick = drag.moved < 7;
    if (drag.touch && !wasClick) {
      // Phones: one swipe = one frame, like flicking through stories.
      // A long drag keeps where you took it and simply settles on the nearest frame.
      const dir = target - anchor;
      vel = 0;
      if (Math.abs(dir) < 1.4) target = Math.abs(dir) > K.nudge ? anchor + Math.sign(dir) : anchor;
      else target = Math.round(target);
      target = target > lastIndex ? endT : clamp(target, 0, lastIndex);
    } else {
      vel = reduced ? 0 : clamp(drag.v, -0.35, 0.35);
    }
    drag = null;
    opts.onDrag?.(false);
    markInput();
    if (wasClick) {
      const hit = pick(e.clientX, e.clientY);
      if (hit) open(hit);
    }
  }
  function onPointerLeave() {
    pointer.inside = false;
  }

  function onKey(e) {
    if (e.target.closest?.('input, textarea, select, [contenteditable], a, button, dialog')) return;
    const cur = Math.round(t);
    let handled = true;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        target = Math.min(Math.round(target) + 1, cur >= lastIndex ? endT : lastIndex);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
      case 'PageUp':
        target = Math.max(Math.round(target) - 1, 0);
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = lastIndex;
        break;
      case 'Enter':
        if (cur <= lastIndex && document.activeElement === document.body) open(stops[clamp(cur, 0, lastIndex)]);
        else handled = false;
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      vel = 0;
      markInput();
    }
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(cx, cy) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const candidates = stops.filter((s) => s.mesh.visible && s.alpha > 0.35).map((s) => s.mesh);
    const hit = raycaster.intersectObjects(candidates, false)[0];
    return hit ? hit.object.userData.stop : null;
  }

  // ---------- projection helpers ----------
  const v3 = new THREE.Vector3();
  function screenRect(s) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [sx, sy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      v3.set(sx, sy, 0).applyMatrix4(s.mesh.matrixWorld).project(camera);
      const x = (v3.x * 0.5 + 0.5) * vw;
      const y = (-v3.y * 0.5 + 0.5) * vh;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const r = host.getBoundingClientRect();
    return new DOMRect(minX + r.left, minY + r.top, maxX - minX, maxY - minY);
  }

  // ---------- open ----------
  let opening = false;
  function open(s) {
    if (opening) return;
    opening = true;
    s.mesh.updateMatrixWorld();
    const rect = s.mesh.visible && s.alpha > 0.2 ? screenRect(s) : null;
    const src = s.kind === 'film' ? s.media.poster || s.story.cover : s.url;
    opts.onOpen(s.story.slug, { rect, src, t: s.i });
    setTimeout(() => (opening = false), 1200);
  }

  /** Glide to a stop (used by the progress ticks and caption). */
  function goTo(i) {
    target = clamp(i, 0, endT);
    vel = 0;
    markInput();
  }
  function goToStory(si) {
    goTo(firstStopOfStory[si] ?? 0);
  }

  // ---------- film previews ----------
  let film = null; // { stop, wrap, iframe, shownAt }
  function embedSrc(m) {
    if (m.provider === 'youtube') {
      const p = new URLSearchParams({ autoplay: '1', mute: '1', controls: '0', loop: '1', playlist: m.id, playsinline: '1', rel: '0', modestbranding: '1' });
      return `https://www.youtube-nocookie.com/embed/${m.id}?${p}`;
    }
    return `https://player.vimeo.com/video/${m.id}?background=1&dnt=1`;
  }
  function startFilm(s) {
    stopFilm();
    const wrap = document.createElement('div');
    wrap.className = 'corridor__film';
    const iframe = document.createElement('iframe');
    iframe.src = embedSrc(s.media);
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.title = `${s.story.title} — film preview`;
    wrap.append(iframe);
    filmLayer.append(wrap);
    film = { stop: s, wrap, loaded: false, at: performance.now() };
    iframe.addEventListener('load', () => {
      if (!film || film.wrap !== wrap) return;
      film.loaded = true;
      film.at = performance.now();
    });
  }
  function stopFilm() {
    if (!film) return;
    const { wrap, stop } = film;
    stop.filmTarget = 0;
    wrap.classList.remove('is-on');
    setTimeout(() => wrap.remove(), 500);
    film = null;
  }
  function updateFilm(settled) {
    const cur = stops[clamp(Math.round(t), 0, lastIndex)];
    const want = !reduced && !saveData && settled && cur.kind === 'film' && cur.alpha > 0.8 && !opening ? cur : null;
    if (want && (!film || film.stop !== want)) startFilm(want);
    else if (!want && film && Math.abs(film.stop.i - t) > 0.35) stopFilm();
    if (film) {
      const s = film.stop;
      const r = screenRect(s);
      const hostRect = host.getBoundingClientRect();
      film.wrap.style.transform = `translate3d(${r.left - hostRect.left}px, ${r.top - hostRect.top}px, 0)`;
      film.wrap.style.width = `${r.width}px`;
      film.wrap.style.height = `${r.height}px`;
      film.wrap.style.borderRadius = `${Math.min(r.width, r.height) * 0.018 * (Math.max(s.w, s.h) / Math.min(s.w, s.h))}px`;
      // Give the player a beat to start before revealing it over the poster.
      const on = film.loaded && performance.now() - film.at > 900;
      film.wrap.classList.toggle('is-on', on);
      s.filmTarget = on ? 1 : 0;
    }
  }

  // ---------- frame loop ----------
  let raf = 0;
  let last = performance.now();
  let disposed = false;
  let lastCur = -1;
  let lastStory = -1;
  let frameCount = 0;
  const startTime = performance.now();

  let active = true;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!active) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = (now - startTime) / 1000;
    frameCount++;

    // inertia + magnetic snap
    if (!drag && !scrollDriven) {
      if (Math.abs(vel) > 0.0004) {
        target += vel * dt * 60;
        vel *= Math.pow(K.inertia, dt * 60);
        clampTarget();
      } else if (now - lastInput > K.snapDelay) {
        // Direction-aware magnetic snap: a small nudge (one wheel notch, a short swipe)
        // is enough to carry you to the next frame in that direction.
        const dir = target - anchor;
        let snapTo = Math.round(target);
        if (Math.abs(dir) > K.nudge) snapTo = dir > 0 ? Math.ceil(target - K.nudge) : Math.floor(target + K.nudge);
        snapTo = target > lastIndex + 0.25 ? endT : clamp(snapTo, 0, lastIndex);
        target += (snapTo - target) * damp(0.12, dt);
        if (Math.abs(snapTo - target) < 0.0005) {
          target = snapTo;
          anchor = Math.round(snapTo);
        }
      }
    }
    t += (target - t) * (reduced ? 1 : damp(scrollDriven ? 0.22 : K.damping, dt));
    if (Math.abs(target - t) < 0.0002) t = target;

    const p = pathAt(clamp(t, 0, endT));
    cam.x = p.x;
    cam.y = p.y - (isMobile ? visH * K.mobileLift : 0);
    cam.z = p.z + K.viewDist;
    camera.position.set(cam.x, cam.y, cam.z);

    if (!reduced) {
      const tx = pointer.inside && !drag ? pointer.nx : 0;
      const ty = pointer.inside && !drag ? pointer.ny : 0;
      look.x += (tx - look.x) * damp(0.04, dt);
      look.y += (ty - look.y) * damp(0.04, dt);
    }
    camera.rotation.set(look.y * K.parallax * 0.7, -look.x * K.parallax, 0);
    camera.updateMatrixWorld();

    if (frameCount % 8 === 0) manageTextures();

    // hover (skip while dragging / on touch)
    let h = null;
    if (pointer.inside && !drag && revealed) h = pick(pointer.x, pointer.y);
    if (h !== hovered) {
      hovered = h;
      opts.onHover?.(h);
    }

    const settled = Math.abs(target - t) < 0.02 && !drag;
    const cur = clamp(Math.round(t), 0, lastIndex);

    for (const s of stops) {
      const rel = cam.z - s.z;
      const u = s.mat.uniforms;
      if (rel < -1 || rel > K.fogFar + 2) {
        s.mesh.visible = false;
        s.glow.visible = false;
        s.alpha = 0;
        continue;
      }
      // reveal (staggered entrance)
      if (revealed && s.reveal < 1) {
        const k = clamp((now - s.revealAt) / 1500, 0, 1);
        s.reveal = reduced ? 1 : easeOutCubic(k);
      }
      const e = s.reveal;
      const dz = rel - K.viewDist;
      const near = smoothstep(0.35, 1.9, rel);
      const far = 1 - smoothstep(K.fogNear, K.fogFar, rel);
      s.alpha = near * far * e;

      s.hover += ((hovered === s ? 1 : 0) - s.hover) * damp(0.12, dt);
      if (s.texState === 'ready') s.texOn += (1 - s.texOn) * damp(0.06, dt);
      s.filmOn += ((s.filmTarget || 0) - s.filmOn) * damp(0.1, dt);

      const focus = Math.max(1 - smoothstep(0.4, 3.4, Math.abs(dz)), s.hover * 0.85);
      u.uAlpha.value = s.alpha;
      u.uFocus.value = focus;
      u.uBlur.value = Math.min(Math.abs(dz) * K.blurPerUnit, K.blurMax) * (1 - s.hover * 0.7);
      u.uHover.value = s.hover;
      u.uTexOn.value = s.texOn;
      u.uFilmOn.value = s.filmOn;

      const float = reduced ? 0 : Math.sin(time * 0.45 + s.seed * 12) * 0.035;
      const fromCenter = 1 - e;
      const x = s.x + (cam.x - s.x) * fromCenter * 0.7;
      const y = s.y + float + (cam.y - s.y) * fromCenter * 0.7;
      const z = s.z + s.hover * 0.14 + fromCenter * 0.6;
      const scale = (0.84 + 0.16 * e) * (1 + s.hover * 0.025);
      s.mesh.position.set(x, y, z);
      s.mesh.scale.set(s.w * scale, s.h * scale, 1);
      s.mesh.visible = s.alpha > 0.002;

      const newestPulse = s.storyIndex === 0 && s.kind === 'cover' ? 0.18 + Math.sin(time * 1.6) * 0.06 : 0;
      const glow = (s.hover * 0.55 + newestPulse) * s.alpha;
      s.glow.material.uniforms.uGlow.value = glow;
      s.glow.position.set(x, y, z - 0.01);
      s.glow.scale.set((s.w + Math.min(s.w, s.h) * 0.5) * scale, (s.h + Math.min(s.w, s.h) * 0.5) * scale, 1);
      s.glow.visible = glow > 0.003;
    }

    dustMat.uniforms.uTime.value = reduced ? 0 : time;
    dustMat.uniforms.uOpacity.value += ((revealed ? 1 : 0) - dustMat.uniforms.uOpacity.value) * damp(0.02, dt);

    renderer.render(scene, camera);

    // DOM overlays
    updateFilm(settled);
    updateNewBadge();

    if (cur !== lastCur || stops[cur].storyIndex !== lastStory) {
      lastCur = cur;
      lastStory = stops[cur].storyIndex;
      opts.onChange?.({ stop: stops[cur], storyIndex: lastStory, index: cur, total: stops.length, t });
    }
    opts.onFrame?.({ t, end: t > lastIndex + 0.2, dt });
  }

  function updateNewBadge() {
    if (!newBadge) return;
    const s = stops[0];
    const show = revealed && s.mesh.visible && s.alpha > 0.4;
    newBadge.classList.toggle('is-on', show);
    if (!show) return;
    const r = screenRect(s);
    const hostRect = host.getBoundingClientRect();
    newBadge.style.transform = `translate3d(${r.left - hostRect.left + 14}px, ${r.top - hostRect.top + 14}px, 0)`;
  }

  // ---------- public ----------
  function reveal() {
    if (revealed) return;
    revealed = true;
    const now = performance.now();
    const order = [...stops].sort((a, b) => Math.abs(a.i - t) - Math.abs(b.i - t));
    order.forEach((s, k) => (s.revealAt = now + 120 + Math.min(k, 8) * 120));
  }

  function onResize() {
    layout();
  }

  const el = renderer.domElement;
  if (!scrollDriven) el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  el.addEventListener('pointerleave', onPointerLeave);
  if (!scrollDriven) window.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  mobileQuery.addEventListener?.('change', onResize);

  layout();
  raf = requestAnimationFrame(frame);

  return {
    ready,
    reveal,
    goTo,
    goToStory,
    /** Scroll-driven mode: set the camera's target position (in stops). */
    setScrollT(v) {
      target = clamp(v, 0, lastIndex);
    },
    /** Pause rendering while off screen. */
    setActive(v) {
      active = !!v;
    },
    lastIndex,
    firstStopOfStory,
    get t() {
      return t;
    },
    stops,
    knobs: K,
    relayout: layout,
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      stopFilm();
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      mobileQuery.removeEventListener?.('change', onResize);
      for (const s of stops) {
        s.tex?.dispose();
        s.mat.dispose();
        s.glow.material.dispose();
      }
      quad.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      el.remove();
    },
  };
}

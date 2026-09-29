// Spiral vortex — Act I of the home page.
//
// Wedding frames flow along curved spiral arms, cascading from the edges of the
// screen into a warm dark void at the centre. On load it spins in fast and calms to a
// slow drift; scrolling flies the camera into the void, dissolving it into Act II.

import * as THREE from 'three';

/** Feel knobs. */
export const VORTEX = {
  cards: { desktop: 46, mobile: 36 },
  arms: 5,
  twist: 2.6, // radians an arm curls from edge to centre
  radius: 5.2, // outer radius (world units)
  depth: 9, // how far frames fall into the void
  cardHeight: 1.05,
  flowCalm: 0.028, // frame travel per second once calm
  flowIntro: 0.34, // … and during the opening rush
  spinCalm: 0.035, // global rotation (rad/s) once calm
  spinIntro: 0.9,
  calmAfter: 2.6, // seconds to settle
  tilt: 0.42, // how much frames lean along the arm
};

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uTexOn;
  uniform vec2 uPlane;
  uniform float uImgAspect;
  uniform float uAlpha;
  uniform float uDim;
  varying vec2 vUv;
  float sdRound(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 p = (vUv - 0.5) * uPlane;
    float d = sdRound(p, uPlane * 0.5, 0.03 * min(uPlane.x, uPlane.y));
    float aa = fwidth(d);
    float mask = 1.0 - smoothstep(-aa, aa, d);
    vec2 uv = vUv - 0.5;
    float r = (uPlane.x / uPlane.y) / uImgAspect;
    if (r < 1.0) uv.x *= r; else uv.y /= r;
    uv += 0.5;
    vec3 c = texture2D(uTex, uv).rgb;
    c = mix(vec3(0.13, 0.11, 0.1), c, uTexOn);
    // warm grade, consistent with the rest of the site
    c = pow(max(c, 0.0), vec3(0.97, 1.0, 1.07)) * vec3(1.045, 1.0, 0.92);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, mix(0.35, 1.0, uDim));
    c *= mix(0.28, 1.0, uDim);
    gl_FragColor = vec4(c, mask * uAlpha);
  }
`;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function mountVortex(host, { images, reducedMotion = false }) {
  try {
    const test = document.createElement('canvas');
    if (!test.getContext('webgl2')) return null;
  } catch {
    return null;
  }
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  const K = VORTEX;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(isMobile ? 62 : 50, 1, 0.05, 60);
  const quad = new THREE.PlaneGeometry(1, 1);
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');

  // One texture per image; cards share them.
  const textures = images.map((img) => ({ img, tex: null, ready: false }));
  let disposed = false;
  textures.forEach((t) => {
    loader.load(
      t.img.src,
      (tex) => {
        if (disposed) return tex.dispose();
        tex.colorSpace = THREE.NoColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        t.tex = tex;
        t.ready = true;
        t.aspect = tex.image.width / tex.image.height;
      },
      undefined,
      () => {},
    );
  });

  const count = isMobile ? K.cards.mobile : K.cards.desktop;
  const cards = [];
  for (let i = 0; i < count; i++) {
    const t = textures[i % textures.length];
    const aspect = clamp(t.img.aspect || 0.75, 0.62, 1.5);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTex: { value: null },
        uTexOn: { value: 0 },
        uPlane: { value: new THREE.Vector2(aspect, 1) },
        uImgAspect: { value: aspect },
        uAlpha: { value: 0 },
        uDim: { value: 1 },
      },
    });
    const mesh = new THREE.Mesh(quad, mat);
    scene.add(mesh);
    const arm = i % K.arms;
    const perArm = Math.ceil(count / K.arms);
    const seed = (Math.sin((i + 1) * 91.7) * 0.5 + 0.5);
    cards.push({
      mesh,
      mat,
      t,
      aspect,
      arm,
      // spread cards evenly along each arm, with a little jitter
      u: (Math.floor(i / K.arms) + seed * 0.6) / perArm,
      seed,
      texOn: 0,
    });
  }

  let vw = 1, vh = 1;
  function layout() {
    vw = host.clientWidth || window.innerWidth;
    vh = host.clientHeight || window.innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
  }
  layout();
  window.addEventListener('resize', layout);

  // pointer parallax (mouse only)
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    look.tx = (e.clientX / vw) * 2 - 1;
    look.ty = (e.clientY / vh) * 2 - 1;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  let scroll = 0; // 0 = resting, 1 = flown through
  let visible = true;
  let raf = 0;
  let last = performance.now();
  const start = last;
  let spin = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = (now - start) / 1000;

    const calm = reducedMotion ? 1 : smoothstep(0.2, K.calmAfter, time);
    const flow = reducedMotion ? 0 : K.flowIntro + (K.flowCalm - K.flowIntro) * calm;
    spin += (reducedMotion ? 0 : K.spinIntro + (K.spinCalm - K.spinIntro) * calm) * dt;
    const intro = reducedMotion ? 1 : smoothstep(0, 1.4, time); // overall fade-in

    look.x += (look.tx - look.x) * 0.04;
    look.y += (look.ty - look.y) * 0.04;
    // Scroll flies the camera into the void.
    const s = scroll * scroll;
    camera.position.set(look.x * 0.35, -look.y * 0.25, 7 - s * 8.5);
    camera.lookAt(look.x * 0.1, -look.y * 0.08, -4);

    const radius = K.radius * (isMobile ? 0.9 : 1);
    const stretchY = camera.aspect < 1 ? Math.min(1.7, 1 / camera.aspect) * 0.85 : 1;
    for (const c of cards) {
      c.u += flow * dt * (0.85 + c.seed * 0.3);
      if (c.u >= 1) c.u -= 1;
      const u = c.u;
      const inward = 1 - u;
      const r = radius * Math.pow(inward, 1.25) + 0.25;
      const theta = (c.arm / K.arms) * Math.PI * 2 + inward * K.twist + spin;
      const z = -u * K.depth;
      const scale = K.cardHeight * (0.35 + 0.65 * inward) * (isMobile ? 1.15 : 1);
      // portrait screens: stretch the spiral into an oval so it fills the height
      c.mesh.position.set(Math.cos(theta) * r, Math.sin(theta) * r * stretchY, z);
      c.mesh.rotation.set(0, 0, theta + Math.PI / 2 * K.tilt);
      c.mesh.scale.set(scale * c.aspect, scale, 1);

      if (c.t.ready) {
        if (c.mat.uniforms.uTex.value !== c.t.tex) {
          c.mat.uniforms.uTex.value = c.t.tex;
          c.mat.uniforms.uImgAspect.value = c.t.aspect;
        }
        c.texOn += (1 - c.texOn) * 0.05;
      }
      c.mat.uniforms.uTexOn.value = c.texOn;
      // fade in at the edge, fade out into the void, and away as you fly through
      const a = smoothstep(0, 0.12, u) * (1 - smoothstep(0.72, 1, u)) * intro * (1 - smoothstep(0.55, 1, scroll));
      c.mat.uniforms.uAlpha.value = a;
      c.mat.uniforms.uDim.value = 1 - u * 0.85;
      c.mesh.visible = a > 0.003;
    }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    setScroll(p) {
      scroll = clamp(p, 0, 1);
    },
    setVisible(v) {
      if (v && !visible) last = performance.now();
      visible = v;
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
      window.removeEventListener('pointermove', onMove);
      cards.forEach((c) => c.mat.dispose());
      textures.forEach((t) => t.tex?.dispose());
      quad.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

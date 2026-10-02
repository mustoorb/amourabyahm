// "Where we've been" globe.
//
// A dark, warm dotted globe with a pin for every place we've shot, and soft arcs
// from the studio bases (Paris, Dubai). Pins are DOM buttons laid over the canvas,
// so they're crisp, tappable and accessible; nearby places merge into one numbered
// pin and split apart as you zoom in.

import * as THREE from 'three';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (k, dt) => 1 - Math.pow(1 - k, dt * 60);

/** lat/lng → point on a sphere of radius r (three-globe convention). */
export function toVec(lat, lng, r = 1) {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}
/** Great-circle distance in km. */
function km(a, b) {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const CORE_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const CORE_FRAG = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
    vec3 c = mix(vec3(0.07, 0.055, 0.05), vec3(0.2, 0.13, 0.12), f);
    gl_FragColor = vec4(c, 1.0);
  }
`;
const ATMO_FRAG = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    // back faces of a slightly larger sphere: brightest just outside the globe's edge,
    // fading to nothing at the halo's outer rim
    float i = pow(clamp(-dot(vN, vV) / 0.5, 0.0, 1.0), 2.2) * 0.42;
    gl_FragColor = vec4(vec3(0.85, 0.56, 0.52) * i, i);
  }
`;
const DOT_VERT = /* glsl */ `
  uniform float uSize;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * position);
    float facing = dot(n, normalize(-mv.xyz));
    vA = smoothstep(0.0, 0.55, facing);
    gl_PointSize = uSize * (0.55 + 0.45 * facing);
    gl_Position = projectionMatrix * mv;
  }
`;
const DOT_FRAG = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.2, d) * vA * 0.62;
    gl_FragColor = vec4(vec3(0.86, 0.79, 0.72), a);
  }
`;
const ARC_VERT = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const ARC_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  varying float vT;
  void main() {
    float head = fract(uTime * 0.16 + uSeed);
    float pulse = exp(-abs(vT - head) * 18.0) * step(vT, head + 0.02);
    float a = (0.24 + 0.85 * pulse) * uOpacity * smoothstep(0.0, 0.05, vT) * smoothstep(1.0, 0.95, vT);
    vec3 c = mix(vec3(0.85, 0.64, 0.63), vec3(0.79, 0.65, 0.42), vT);
    gl_FragColor = vec4(c * a, a);
  }
`;

/**
 * @param {HTMLElement} host       container with [data-globe-canvas] and [data-globe-pins]
 * @param {object} opts
 * @param {Array<{place,country,lat,lng,stories:Array}>} opts.places
 * @param {Array<{label,lat,lng}>} opts.bases
 * @param {number[]} opts.land     flat [lat*100, lng*100, …]
 * @param {(places:Array) => void} opts.onSelect
 * @param {boolean} [opts.reducedMotion]
 */
export function mountGlobe(host, opts) {
  try {
    if (!document.createElement('canvas').getContext('webgl2')) return null;
  } catch {
    return null;
  }
  const reduced = !!opts.reducedMotion;
  const canvasHost = host.querySelector('[data-globe-canvas]');
  const pinLayer = host.querySelector('[data-globe-pins]');
  const isMobile = window.matchMedia('(max-width: 760px)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.75 : 2));
  canvasHost.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const globe = new THREE.Group();
  scene.add(globe);

  // core + atmosphere
  const coreGeo = new THREE.SphereGeometry(0.995, 64, 48);
  const core = new THREE.Mesh(coreGeo, new THREE.ShaderMaterial({ vertexShader: CORE_VERT, fragmentShader: CORE_FRAG }));
  globe.add(core);
  const atmoGeo = new THREE.SphereGeometry(1.16, 64, 48);
  const atmo = new THREE.Mesh(
    atmoGeo,
    new THREE.ShaderMaterial({ vertexShader: CORE_VERT, fragmentShader: ATMO_FRAG, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  scene.add(atmo);

  // land dots
  const land = opts.land;
  const pos = new Float32Array((land.length / 2) * 3);
  for (let i = 0, j = 0; i < land.length; i += 2, j += 3) {
    const v = toVec(land[i] / 100, land[i + 1] / 100, 1.001);
    pos[j] = v.x;
    pos[j + 1] = v.y;
    pos[j + 2] = v.z;
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dotMat = new THREE.ShaderMaterial({
    vertexShader: DOT_VERT,
    fragmentShader: DOT_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: { uSize: { value: 2.6 * renderer.getPixelRatio() } },
  });
  globe.add(new THREE.Points(dotGeo, dotMat));

  // places + arcs from the nearest base
  const places = opts.places.map((p, i) => ({ ...p, i, vec: toVec(p.lat, p.lng, 1.004), key: `${p.place}|${p.country}` }));
  const bases = opts.bases.map((b) => ({ ...b, vec: toVec(b.lat, b.lng, 1.004) }));
  const arcs = [];
  for (const p of places) {
    let base = bases[0];
    for (const b of bases) if (km(b, p) < km(base, p)) base = b;
    const d = km(base, p);
    if (!base || d < 250) continue; // too close to home for an arc to read
    const a = base.vec.clone();
    const b = p.vec.clone();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.normalize().multiplyScalar(1 + Math.min(0.45, 0.08 + d / 14000));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const pts = curve.getPoints(64);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(pts.map((_, k) => k / (pts.length - 1))), 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: ARC_VERT,
      fragmentShader: ARC_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSeed: { value: Math.random() }, uOpacity: { value: 1 } },
    });
    const line = new THREE.Line(geo, mat);
    globe.add(line);
    arcs.push(line);
  }

  // DOM pins
  const pinEls = places.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pin';
    b.innerHTML = `<span class="pin__dot"></span><span class="pin__count"></span><span class="pin__label"></span>`;
    b.dataset.key = p.key;
    pinLayer.append(b);
    return b;
  });
  const baseEls = bases.map((b) => {
    const s = document.createElement('span');
    s.className = 'pin pin--base';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = `<span class="pin__dot"></span><span class="pin__label">${b.label}</span>`;
    pinLayer.append(s);
    return s;
  });

  // view state
  const DIST_FAR = 5.2; // globe fills ~70% of the frame, leaving room for its halo
  const DIST_NEAR = 2.5;
  const start = places[0] ?? bases[0] ?? { lat: 30, lng: 20 };
  let rotY = -(((start.lng ?? 20) + 90) * DEG);
  let rotX = clamp((start.lat ?? 30) * DEG * 0.7, -0.9, 0.9);
  let tRotY = rotY, tRotX = rotX;
  let dist = DIST_FAR, tDist = DIST_FAR;
  let vY = 0;
  let lastUser = -1e9;
  let hovering = false;
  let paused = false; // e.g. while a card is open
  let active = true;

  function focusOn(lat, lng, near = true) {
    const target = -((lng + 90) * DEG);
    // shortest way round
    tRotY = rotY + ((((target - rotY) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    tRotX = clamp(lat * DEG, -0.9, 0.9);
    tDist = near ? DIST_NEAR : DIST_FAR;
    lastUser = performance.now();
  }

  // drag to spin (touch: horizontal swipes spin, vertical ones scroll the page)
  let drag = null;
  const el = renderer.domElement;
  const onDown = (e) => {
    drag = { x: e.clientX, y: e.clientY, t: performance.now() };
    vY = 0;
  };
  const onMove = (e) => {
    if (e.pointerType === 'mouse') hovering = true;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    const k = 0.0055 * (dist / DIST_FAR);
    tRotY += dx * k;
    rotY += dx * k;
    if (e.pointerType === 'mouse') {
      tRotX = clamp(tRotX + dy * k, -0.9, 0.9);
      rotX = tRotX;
    }
    vY = dx * k;
    lastUser = performance.now();
  };
  const onUp = () => {
    drag = null;
  };
  const onLeave = () => (hovering = false);
  el.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  el.addEventListener('pointerleave', onLeave);

  // clusters, recomputed every frame (cheap: a few dozen places)
  let clusters = [];
  const onPin = (e) => {
    const key = e.currentTarget.dataset.key;
    const c = clusters.find((cl) => cl.leader.key === key);
    if (!c) return;
    const multi = c.members.length > 1;
    if (multi && tDist > DIST_NEAR + 0.2) {
      focusOn(c.leader.lat, c.leader.lng, true); // zoom in to split it
    } else {
      focusOn(c.leader.lat, c.leader.lng, tDist <= DIST_NEAR + 0.2);
      opts.onSelect(c.members);
    }
  };
  pinEls.forEach((b) => b.addEventListener('click', onPin));

  // layout
  let w = 1, h = 1;
  const layout = () => {
    w = host.clientWidth || 1;
    h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(layout);
  ro.observe(host);
  layout();

  const v = new THREE.Vector3();
  const camN = new THREE.Vector3();
  let raf = 0;
  let last = performance.now();
  const t0 = last;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!active) {
      last = now;
      return;
    }
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); // frame timestamps can precede `last`
    last = now;
    const idle = now - lastUser > 3500 && !hovering && !paused && !drag;
    if (!reduced && idle) tRotY += 0.05 * dt; // slow auto-turn
    if (!drag && !reduced) {
      tRotY += vY;
      vY *= Math.pow(0.92, dt * 60);
    }
    const k = reduced ? 1 : damp(0.08, dt);
    rotY += (tRotY - rotY) * k;
    rotX += (tRotX - rotX) * k;
    dist += (tDist - dist) * k;
    globe.rotation.set(rotX, rotY, 0, 'XYZ');
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    globe.updateMatrixWorld();
    camN.copy(camera.position).normalize();

    const time = (now - t0) / 1000;
    for (const a of arcs) a.material.uniforms.uTime.value = reduced ? 0.4 : time;

    renderer.render(scene, camera);

    // project pins
    const visible = [];
    for (const p of places) {
      v.copy(p.vec).applyMatrix4(globe.matrixWorld);
      const facing = v.clone().normalize().dot(camN);
      v.project(camera);
      p.sx = (v.x * 0.5 + 0.5) * w;
      p.sy = (-v.y * 0.5 + 0.5) * h;
      p.facing = facing;
      const r = Math.hypot(p.sx - w / 2, p.sy - h / 2) / (Math.min(w, h) / 2);
      if (facing > 0.18 && r < 0.9) visible.push(p);
    }
    // greedy clustering in screen space, biggest places lead
    const R = isMobile ? 26 : 30;
    visible.sort((a, b) => b.stories.length - a.stories.length);
    clusters = [];
    for (const p of visible) {
      const c = clusters.find((cl) => Math.hypot(cl.leader.sx - p.sx, cl.leader.sy - p.sy) < R);
      if (c) c.members.push(p);
      else clusters.push({ leader: p, members: [p] });
    }
    const leaders = new Set(clusters.map((c) => c.leader));
    for (const p of places) {
      const b = pinEls[p.i];
      const c = leaders.has(p) ? clusters.find((cl) => cl.leader === p) : null;
      if (!c) {
        b.classList.add('is-hidden');
        b.tabIndex = -1;
        continue;
      }
      const n = c.members.reduce((s, m) => s + m.stories.length, 0);
      const multi = c.members.length > 1;
      b.classList.remove('is-hidden');
      b.tabIndex = 0;
      b.classList.toggle('is-cluster', multi);
      b.style.transform = `translate3d(${p.sx}px, ${p.sy}px, 0)`;

      b.style.opacity = String(clamp((p.facing - 0.18) / 0.25, 0, 1));
      const label = multi ? (isMobile ? p.country : `${p.country} · ${c.members.length} places`) : p.place;
      if (b.dataset.label !== label) {
        b.dataset.label = label;
        b.querySelector('.pin__label').textContent = label;
        b._lw = 0; // re-measure
        b.setAttribute('aria-label', `${label} — ${n} wedding${n > 1 ? 's' : ''}`);
      }
      b.querySelector('.pin__count').textContent = n > 1 ? String(n) : '';
      // put the label on whichever side has room; trim it if neither does
      const lab = b.querySelector('.pin__label');
      if (!b._lw) {
        lab.style.maxWidth = '';
        b._lw = lab.offsetWidth;
      }
      const right = w - p.sx - 34;
      const left = p.sx - 34;
      const onLeft = right < b._lw && left > right;
      b.classList.toggle('is-left', onLeft);
      lab.style.maxWidth = `${Math.max(60, (onLeft ? left : right) - 6)}px`;
    }
    bases.forEach((b, i) => {
      v.copy(b.vec).applyMatrix4(globe.matrixWorld);
      const facing = v.clone().normalize().dot(camN);
      v.project(camera);
      const el = baseEls[i];
      const bx = (v.x * 0.5 + 0.5) * w;
      const by = (-v.y * 0.5 + 0.5) * h;
      el.style.transform = `translate3d(${bx}px, ${by}px, 0)`;
      const inside = Math.hypot(bx - w / 2, by - h / 2) / (Math.min(w, h) / 2) < 0.9;
      el.style.opacity = String(inside ? clamp((facing - 0.18) / 0.25, 0, 1) : 0);
      const crowded = clusters.some((c) => Math.hypot(c.leader.sx - bx, c.leader.sy - by) < 36);
      el.classList.toggle('is-quiet', crowded);
    });
  }
  raf = requestAnimationFrame(frame);

  return {
    setActive(on) {
      active = !!on;
    },
    setPaused(on) {
      paused = !!on;
      if (!on) lastUser = performance.now();
    },
    zoomedIn: () => tDist < DIST_FAR - 0.3,
    reset() {
      tDist = DIST_FAR;
      tRotX = clamp(tRotX, -0.5, 0.5);
      lastUser = performance.now();
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('pointerleave', onLeave);
      pinEls.forEach((b) => b.remove());
      baseEls.forEach((b) => b.remove());
      arcs.forEach((a) => {
        a.geometry.dispose();
        a.material.dispose();
      });
      coreGeo.dispose();
      atmoGeo.dispose();
      dotGeo.dispose();
      dotMat.dispose();
      core.material.dispose();
      atmo.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      el.remove();
    },
  };
}

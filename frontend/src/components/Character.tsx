import * as THREE from 'three';
import type { AudioReactiveMetrics, CompanionState } from '../hooks/useLloydSocket';
import {
  DEFAULT_CUSTOMIZATION,
  type CharacterCustomizationState,
  type RobotEmotion,
} from '../types/customization';

export interface CharacterController {
  root: THREE.Group;
  applyCustomization: (custom: CharacterCustomizationState) => void;
  setEmotion: (emotion: RobotEmotion) => void;
  triggerWaveOrReaction: (emotion?: RobotEmotion) => void;
  update: (
    elapsed: number,
    delta: number,
    state: CompanionState,
    audio: AudioReactiveMetrics,
    pointer: { x: number; y: number },
    micLevel: number
  ) => void;
  dispose: () => void;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(
    clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean,
    16
  );
  if (Number.isNaN(num)) return { r: 56, g: 189, b: 248 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Normalizes a partial SphereGeometry patch's UVs so that the entire [0..1]
 * CanvasTexture maps cleanly edge-to-edge across the visor surface without cropping.
 */
function normalizeSpherePatchUVs(geometry: THREE.BufferGeometry) {
  const uvAttr = geometry.attributes.uv;
  if (!uvAttr) return;
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;

  for (let i = 0; i < uvAttr.count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  const rangeU = Math.max(0.0001, maxU - minU);
  const rangeV = Math.max(0.0001, maxV - minV);

  for (let i = 0; i < uvAttr.count; i++) {
    const u = (uvAttr.getX(i) - minU) / rangeU;
    const v = (uvAttr.getY(i) - minV) / rangeV;
    uvAttr.setXY(i, u, v);
  }
  uvAttr.needsUpdate = true;
}

export function createAnimeCompanion(
  initialCustomization: CharacterCustomizationState = DEFAULT_CUSTOMIZATION
): CharacterController {
  const root = new THREE.Group();
  // Positioned and scaled so the entire robot sits comfortably in the center of the viewport
  root.position.set(0, -0.58, 0);
  root.scale.setScalar(0.84);

  let currentCustom: CharacterCustomizationState = { ...initialCustomization };
  let activeEmotion: RobotEmotion = 'happy';
  let reactionUntil = 0;
  let waveUntil = 0;

  // ==========================================================================
  // 1. HIGH-CRAFT AEROSPACE ROBOT MATERIALS
  // ==========================================================================
  const shellPrimaryMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(currentCustom.hairPrimaryHex),
    roughness: 0.2,
    metalness: 0.12,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    reflectivity: 0.95,
  });

  const shellSecondaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(currentCustom.outfitJacketHex),
    roughness: 0.32,
    metalness: 0.68,
  });

  const darkChassisMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(currentCustom.outlineHex),
    roughness: 0.38,
    metalness: 0.8,
  });

  const accentGlowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(currentCustom.cyberAccentHex),
    emissive: new THREE.Color(currentCustom.cyberAccentHex),
    emissiveIntensity: currentCustom.eyeLuminescence * 1.2,
    roughness: 0.15,
    metalness: 0.4,
  });

  const secondaryGlowMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(currentCustom.auraRingHex),
    emissive: new THREE.Color(currentCustom.auraRingHex),
    emissiveIntensity: currentCustom.eyeLuminescence,
    roughness: 0.2,
    metalness: 0.4,
  });

  const trimAccentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(currentCustom.hairAccentHex),
    emissive: new THREE.Color(currentCustom.hairAccentHex),
    emissiveIntensity: 0.4,
    roughness: 0.22,
    metalness: 0.55,
    clearcoat: 0.7,
  });

  // ==========================================================================
  // 2. CURVED 60FPS OLED VISOR FACE DISPLAY (1024 x 512)
  // ==========================================================================
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 1024;
  faceCanvas.height = 512;
  const faceCtx = faceCanvas.getContext('2d')!;

  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.minFilter = THREE.LinearFilter;
  faceTexture.magFilter = THREE.LinearFilter;

  const visorScreenMat = new THREE.MeshBasicMaterial({
    map: faceTexture,
  });

  const visorGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x050814,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 1.0,
  });

  // ==========================================================================
  // 3. ROBOT BODY HIERARCHY: HOVER POD -> TORSO -> NECK -> HEAD -> ARMS
  // ==========================================================================
  const hoverGroup = new THREE.Group();
  hoverGroup.position.set(0, 0.52, 0);
  root.add(hoverGroup);

  const torsoGroup = new THREE.Group();
  hoverGroup.add(torsoGroup);

  // --- 3.1 Sculpted Rounded Aerospace Torso (EVE / Astro-inspired silhouette) ---
  const torsoBodyGeo = new THREE.SphereGeometry(0.34, 48, 36);
  torsoBodyGeo.scale(0.96, 1.18, 0.78);
  const torsoBodyMesh = new THREE.Mesh(torsoBodyGeo, shellPrimaryMat);
  torsoBodyMesh.position.set(0, 0.28, 0);
  torsoBodyMesh.castShadow = true;
  torsoBodyMesh.receiveShadow = true;
  torsoGroup.add(torsoBodyMesh);

  // Sleek Dark Shoulder Collar & Upper Chest Yoke
  const yokeGeo = new THREE.SphereGeometry(0.344, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.36);
  yokeGeo.scale(0.97, 1.18, 0.79);
  const yokeMesh = new THREE.Mesh(yokeGeo, shellSecondaryMat);
  yokeMesh.position.set(0, 0.285, 0);
  torsoGroup.add(yokeMesh);

  // Lower Hover Propulsion Thruster Bell & Anti-Gravity Plume
  const thrusterBellGeo = new THREE.CylinderGeometry(0.18, 0.09, 0.16, 32);
  const thrusterBell = new THREE.Mesh(thrusterBellGeo, darkChassisMat);
  thrusterBell.position.set(0, -0.12, 0);
  torsoGroup.add(thrusterBell);

  const waistRingGeo = new THREE.TorusGeometry(0.21, 0.012, 14, 48);
  const waistRing = new THREE.Mesh(waistRingGeo, trimAccentMat);
  waistRing.rotation.x = Math.PI / 2;
  waistRing.position.set(0, -0.04, 0);
  torsoGroup.add(waistRing);

  const thrusterPlumeGroup = new THREE.Group();
  thrusterPlumeGroup.position.set(0, -0.2, 0);
  torsoGroup.add(thrusterPlumeGroup);

  const plumeConeGeo = new THREE.ConeGeometry(0.085, 0.28, 24, 1, true);
  const plumeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(currentCustom.cyberAccentHex),
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const plumeCone = new THREE.Mesh(plumeConeGeo, plumeMat);
  plumeCone.rotation.x = Math.PI;
  plumeCone.position.y = -0.12;
  thrusterPlumeGroup.add(plumeCone);

  const thrusterRingGeo = new THREE.TorusGeometry(0.08, 0.007, 12, 32);
  const thrusterRing1 = new THREE.Mesh(thrusterRingGeo, accentGlowMat);
  thrusterRing1.rotation.x = Math.PI / 2;
  thrusterRing1.position.y = -0.03;
  thrusterPlumeGroup.add(thrusterRing1);

  const thrusterRing2 = new THREE.Mesh(thrusterRingGeo, secondaryGlowMat);
  thrusterRing2.rotation.x = Math.PI / 2;
  thrusterRing2.scale.setScalar(0.68);
  thrusterRing2.position.y = -0.11;
  thrusterPlumeGroup.add(thrusterRing2);

  // Chest Glowing Accent Seams
  const seamGeo = new THREE.CapsuleGeometry(0.009, 0.22, 8, 12);
  const leftSeam = new THREE.Mesh(seamGeo, trimAccentMat);
  leftSeam.position.set(-0.18, 0.28, 0.235);
  leftSeam.rotation.z = -0.18;
  leftSeam.rotation.x = 0.12;
  torsoGroup.add(leftSeam);

  const rightSeam = new THREE.Mesh(seamGeo, trimAccentMat);
  rightSeam.position.set(0.18, 0.28, 0.235);
  rightSeam.rotation.z = 0.18;
  rightSeam.rotation.x = 0.12;
  torsoGroup.add(rightSeam);

  // --- 3.2 Central Chest Gyroscope Reactor Core ---
  const reactorGroup = new THREE.Group();
  reactorGroup.position.set(0, 0.31, 0.258);
  torsoGroup.add(reactorGroup);

  const reactorBezelGeo = new THREE.TorusGeometry(0.082, 0.014, 16, 40);
  const reactorBezel = new THREE.Mesh(reactorBezelGeo, darkChassisMat);
  reactorGroup.add(reactorBezel);

  const reactorBackGeo = new THREE.CircleGeometry(0.08, 32);
  const reactorBack = new THREE.Mesh(
    reactorBackGeo,
    new THREE.MeshBasicMaterial({ color: 0x040711 })
  );
  reactorBack.position.z = -0.008;
  reactorGroup.add(reactorBack);

  const gyroOuterGeo = new THREE.TorusGeometry(0.058, 0.006, 12, 32);
  const gyroOuter = new THREE.Mesh(gyroOuterGeo, secondaryGlowMat);
  reactorGroup.add(gyroOuter);

  const gyroInnerGeo = new THREE.OctahedronGeometry(0.036, 1);
  const coreMesh = new THREE.Mesh(gyroInnerGeo, accentGlowMat);
  reactorGroup.add(coreMesh);

  // --- 3.3 Precision Neck Gimbal ---
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 0.66, 0);
  torsoGroup.add(neckGroup);

  const neckCylGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.11, 24);
  const neckCyl = new THREE.Mesh(neckCylGeo, darkChassisMat);
  neckCyl.position.y = 0.03;
  neckGroup.add(neckCyl);

  const neckRingGeo = new THREE.TorusGeometry(0.108, 0.008, 10, 28);
  const neckRing = new THREE.Mesh(neckRingGeo, accentGlowMat);
  neckRing.rotation.x = Math.PI / 2;
  neckRing.position.y = 0.04;
  neckGroup.add(neckRing);

  // ==========================================================================
  // 4. SCULPTED ROBOT HEAD & NORMALIZED FULL-FRAME OLED VISOR
  // ==========================================================================
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.0, 0.02);
  torsoGroup.add(headGroup);

  // Rounded Aerospace Cranial Shell
  const headGeo = new THREE.SphereGeometry(0.36, 48, 36);
  headGeo.scale(1.18, 0.92, 0.96);
  const headShell = new THREE.Mesh(headGeo, shellPrimaryMat);
  headShell.castShadow = true;
  headShell.receiveShadow = true;
  headGroup.add(headShell);

  // Forehead Telemetry Sensor Crest
  const crestGeo = new THREE.CapsuleGeometry(0.016, 0.12, 8, 16);
  crestGeo.rotateZ(Math.PI / 2);
  const crestMesh = new THREE.Mesh(crestGeo, trimAccentMat);
  crestMesh.position.set(0, 0.295, 0.155);
  headGroup.add(crestMesh);

  // Dark Recessed Visor Bezel
  const bezelGeo = new THREE.SphereGeometry(
    0.35,
    44,
    32,
    Math.PI * 0.5 - 0.88,
    1.76,
    Math.PI * 0.5 - 0.52,
    1.04
  );
  bezelGeo.scale(1.18, 0.92, 0.98);
  const bezelMesh = new THREE.Mesh(bezelGeo, darkChassisMat);
  bezelMesh.position.set(0, -0.01, 0.012);
  headGroup.add(bezelMesh);

  // Curved Emissive OLED Visor Screen with Normalized [0..1] Patch UVs!
  const visorGeo = new THREE.SphereGeometry(
    0.352,
    48,
    32,
    Math.PI * 0.5 - 0.82,
    1.64,
    Math.PI * 0.5 - 0.46,
    0.92
  );
  visorGeo.scale(1.18, 0.92, 0.99);
  normalizeSpherePatchUVs(visorGeo);

  const visorScreen = new THREE.Mesh(visorGeo, visorScreenMat);
  visorScreen.position.set(0, -0.01, 0.016);
  headGroup.add(visorScreen);

  // Smoked Glass Clearcoat Lens over the Visor
  const visorGlassGeo = visorGeo.clone();
  const visorGlass = new THREE.Mesh(visorGlassGeo, visorGlassMat);
  visorGlass.position.set(0, -0.01, 0.02);
  headGroup.add(visorGlass);

  // --- 4.1 Articulated Ear-Pods & Telemetry Antennas ---
  const createEarPod = (side: -1 | 1) => {
    const earGroup = new THREE.Group();
    earGroup.position.set(side * 0.415, 0.0, 0.0);
    headGroup.add(earGroup);

    const podGeo = new THREE.CylinderGeometry(0.095, 0.078, 0.065, 24);
    podGeo.rotateZ(Math.PI / 2);
    const podMesh = new THREE.Mesh(podGeo, shellSecondaryMat);
    podMesh.castShadow = true;
    earGroup.add(podMesh);

    const earRingGeo = new THREE.TorusGeometry(0.082, 0.01, 12, 28);
    earRingGeo.rotateY(Math.PI / 2);
    const earRing = new THREE.Mesh(earRingGeo, accentGlowMat);
    earRing.position.x = side * 0.028;
    earGroup.add(earRing);

    const antennaPivot = new THREE.Group();
    antennaPivot.position.set(side * 0.02, 0.05, 0);
    earGroup.add(antennaPivot);

    const stalkGeo = new THREE.CapsuleGeometry(0.013, 0.14, 8, 12);
    const stalk = new THREE.Mesh(stalkGeo, trimAccentMat);
    stalk.position.set(side * 0.018, 0.09, -0.015);
    stalk.rotation.z = -side * 0.16;
    stalk.rotation.x = -0.12;
    antennaPivot.add(stalk);

    const tipGeo = new THREE.SphereGeometry(0.022, 14, 14);
    const tip = new THREE.Mesh(tipGeo, accentGlowMat);
    tip.position.set(side * 0.035, 0.175, -0.03);
    antennaPivot.add(tip);

    return { earGroup, antennaPivot, tip };
  };

  const leftEar = createEarPod(-1);
  const rightEar = createEarPod(1);

  // ==========================================================================
  // 5. ARTICULATED ROBOT ARMS & 3-FINGERED HANDS
  // ==========================================================================
  const createRobotArm = (side: -1 | 1) => {
    const shoulderGroup = new THREE.Group();
    shoulderGroup.position.set(side * 0.355, 0.48, 0.0);
    torsoGroup.add(shoulderGroup);

    const pauldronGeo = new THREE.SphereGeometry(0.082, 24, 20);
    const pauldron = new THREE.Mesh(pauldronGeo, shellPrimaryMat);
    pauldron.castShadow = true;
    shoulderGroup.add(pauldron);

    const shoulderRingGeo = new THREE.TorusGeometry(0.068, 0.008, 10, 24);
    const shoulderRing = new THREE.Mesh(shoulderRingGeo, trimAccentMat);
    shoulderRing.rotation.y = Math.PI / 2;
    shoulderRing.position.x = side * 0.018;
    shoulderGroup.add(shoulderRing);

    const upperArmGeo = new THREE.CylinderGeometry(0.04, 0.036, 0.21, 18);
    const upperArm = new THREE.Mesh(upperArmGeo, darkChassisMat);
    upperArm.position.set(0, -0.13, 0);
    shoulderGroup.add(upperArm);

    const elbowGroup = new THREE.Group();
    elbowGroup.position.set(0, -0.24, 0);
    shoulderGroup.add(elbowGroup);

    const elbowBallGeo = new THREE.SphereGeometry(0.044, 16, 16);
    const elbowBall = new THREE.Mesh(elbowBallGeo, shellSecondaryMat);
    elbowGroup.add(elbowBall);

    const forearmGeo = new THREE.CapsuleGeometry(0.052, 0.14, 12, 20);
    const forearm = new THREE.Mesh(forearmGeo, shellPrimaryMat);
    forearm.position.set(0, -0.12, 0);
    forearm.castShadow = true;
    elbowGroup.add(forearm);

    const wristGeo = new THREE.TorusGeometry(0.048, 0.008, 10, 24);
    const wristBand = new THREE.Mesh(wristGeo, accentGlowMat);
    wristBand.rotation.x = Math.PI / 2;
    wristBand.position.set(0, -0.21, 0);
    elbowGroup.add(wristBand);

    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.26, 0.01);
    elbowGroup.add(handGroup);

    const palmGeo = new THREE.SphereGeometry(0.044, 16, 16);
    palmGeo.scale(0.95, 0.85, 0.65);
    const palm = new THREE.Mesh(palmGeo, shellSecondaryMat);
    handGroup.add(palm);

    const fingerGeo = new THREE.CapsuleGeometry(0.011, 0.026, 6, 10);
    const f1 = new THREE.Mesh(fingerGeo, shellPrimaryMat);
    f1.position.set(-0.018, -0.038, 0.008);
    f1.rotation.z = 0.1;
    handGroup.add(f1);

    const f2 = new THREE.Mesh(fingerGeo, shellPrimaryMat);
    f2.position.set(0.0, -0.042, 0.01);
    handGroup.add(f2);

    const f3 = new THREE.Mesh(fingerGeo, shellPrimaryMat);
    f3.position.set(0.018, -0.038, 0.008);
    f3.rotation.z = -0.1;
    handGroup.add(f3);

    const thumb = new THREE.Mesh(fingerGeo, trimAccentMat);
    thumb.position.set(-side * 0.035, -0.016, 0.018);
    thumb.rotation.z = -side * 0.55;
    handGroup.add(thumb);

    return { shoulderGroup, elbowGroup, handGroup };
  };

  const leftArm = createRobotArm(-1);
  const rightArm = createRobotArm(1);

  // ==========================================================================
  // 6. ORBITAL HALO & BASE CONTAINMENT RINGS
  // ==========================================================================
  const haloGroup = new THREE.Group();
  haloGroup.position.set(0, 0.44, -0.24);
  torsoGroup.add(haloGroup);

  const haloRingGeo = new THREE.TorusGeometry(0.36, 0.006, 14, 64);
  const haloRing = new THREE.Mesh(haloRingGeo, accentGlowMat);
  haloGroup.add(haloRing);

  const shardGeo = new THREE.OctahedronGeometry(0.022, 0);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const shard = new THREE.Mesh(
      shardGeo,
      i % 2 === 0 ? accentGlowMat : secondaryGlowMat
    );
    shard.position.set(Math.cos(angle) * 0.42, Math.sin(angle) * 0.42, 0);
    shard.scale.set(0.55, 1.65, 0.55);
    shard.rotation.z = angle;
    haloGroup.add(shard);
  }

  const baseRingGroup = new THREE.Group();
  baseRingGroup.position.set(0, 0.02, 0);
  root.add(baseRingGroup);

  const baseRingGeo = new THREE.RingGeometry(0.48, 0.51, 64);
  const baseRingMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(currentCustom.auraRingHex),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  });
  const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
  baseRing.rotation.x = -Math.PI / 2;
  baseRingGroup.add(baseRing);

  const outerPulseGeo = new THREE.RingGeometry(0.58, 0.6, 64);
  const outerPulseMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(currentCustom.cyberAccentHex),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.28,
  });
  const outerPulseRing = new THREE.Mesh(outerPulseGeo, outerPulseMat);
  outerPulseRing.rotation.x = -Math.PI / 2;
  baseRingGroup.add(outerPulseRing);

  const thinkingGroup = new THREE.Group();
  thinkingGroup.position.set(0, 2.02, 0);
  root.add(thinkingGroup);

  const orbitNodes: THREE.Mesh[] = [];
  const nodeGeo = new THREE.OctahedronGeometry(0.024, 0);
  for (let i = 0; i < 8; i++) {
    const node = new THREE.Mesh(
      nodeGeo,
      i % 2 === 0 ? accentGlowMat : secondaryGlowMat
    );
    const a = (i / 8) * Math.PI * 2;
    node.position.set(
      Math.cos(a) * 0.42,
      Math.sin(a * 2) * 0.04,
      Math.sin(a) * 0.42
    );
    thinkingGroup.add(node);
    orbitNodes.push(node);
  }

  // ==========================================================================
  // 7. 60FPS OLED VISOR FACE ENGINE (EYES, BROWS, CHEEKS, SMILE & LIP-SYNC)
  // ==========================================================================
  let smoothEyeX = 0;
  let smoothEyeY = 0;
  let smoothMouthOpen = 0;
  let smoothSmile = 1.0;

  const renderVisorFace = (
    elapsed: number,
    state: CompanionState,
    audio: AudioReactiveMetrics,
    pointer: { x: number; y: number },
    micLevel: number,
    isBlinking: boolean,
    blinkProgress: number
  ) => {
    const W = faceCanvas.width;
    const H = faceCanvas.height;

    // 1. Deep OLED Screen Background with subtle edge vignette
    const bgGrad = faceCtx.createRadialGradient(
      W * 0.5,
      H * 0.5,
      30,
      W * 0.5,
      H * 0.5,
      W * 0.52
    );
    bgGrad.addColorStop(0, '#0a1328');
    bgGrad.addColorStop(0.7, '#050914');
    bgGrad.addColorStop(1, '#02040a');
    faceCtx.fillStyle = bgGrad;
    faceCtx.fillRect(0, 0, W, H);

    // Subtle OLED pixel scanlines
    faceCtx.fillStyle = 'rgba(255, 255, 255, 0.018)';
    for (let y = 0; y < H; y += 6) {
      faceCtx.fillRect(0, y, W, 2);
    }

    let phosphorHex = currentCustom.eyeIrisHex || '#38bdf8';
    if (state === 'LISTENING') {
      phosphorHex = '#34d399';
    } else if (state === 'THINKING') {
      phosphorHex = '#a78bfa';
    }
    const rgb = hexToRgb(phosphorHex);
    const glowColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    const softGlow = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.38)`;
    const coreWhite = '#f8fafc';

    const targetX = THREE.MathUtils.clamp(pointer.x * 42, -45, 45);
    const targetY = THREE.MathUtils.clamp(-pointer.y * 24, -26, 26);
    smoothEyeX += (targetX - smoothEyeX) * 0.18;
    smoothEyeY += (targetY - smoothEyeY) * 0.18;

    const rawOpen = state === 'SPEAKING' ? Math.max(0.08, audio.mouthOpen) : 0;
    smoothMouthOpen += (rawOpen - smoothMouthOpen) * 0.34;

    const isReacting = elapsed < reactionUntil;
    const effectiveEmotion: RobotEmotion = activeEmotion;

    const targetSmile =
      effectiveEmotion === 'happy' ||
      effectiveEmotion === 'excited' ||
      state === 'SPEAKING'
        ? 1.0
        : effectiveEmotion === 'curious'
        ? 0.35
        : 0.75;
    smoothSmile += (targetSmile - smoothSmile) * 0.14;

    // 2. Draw Left & Right Expressive Robot Eyes (centered in the 1024x512 UV space)
    const drawEye = (side: -1 | 1) => {
      const cx = W * 0.5 + side * 195 + smoothEyeX;
      const cy = H * 0.44 + smoothEyeY;

      faceCtx.save();
      faceCtx.translate(cx, cy);

      const isWinkingThisEye = effectiveEmotion === 'wink' && side === 1;
      const isHappyArcEye =
        effectiveEmotion === 'excited' ||
        (isReacting && effectiveEmotion === 'happy');
      const isZenEye = effectiveEmotion === 'zen';

      // Expressive Eyebrow
      faceCtx.save();
      let browY = -92;
      let browRot = side * -0.05;
      if (state === 'LISTENING') {
        browY = -102 - micLevel * 10;
        browRot = side * -0.02;
      } else if (state === 'THINKING' || effectiveEmotion === 'curious') {
        browY = side === 1 ? -104 : -84;
        browRot = side === 1 ? -0.18 : 0.14;
      } else if (state === 'SPEAKING') {
        browY = -96 - smoothMouthOpen * 12;
        browRot = side * (-0.07 - smoothMouthOpen * 0.05);
      }
      faceCtx.translate(0, browY);
      faceCtx.rotate(browRot);
      faceCtx.shadowColor = glowColor;
      faceCtx.shadowBlur = 18;
      faceCtx.strokeStyle = glowColor;
      faceCtx.lineWidth = 11;
      faceCtx.lineCap = 'round';
      faceCtx.beginPath();
      faceCtx.moveTo(-52, 5);
      faceCtx.quadraticCurveTo(0, -10, 52, 5);
      faceCtx.stroke();
      faceCtx.restore();

      if (isWinkingThisEye || isZenEye) {
        faceCtx.shadowColor = glowColor;
        faceCtx.shadowBlur = 26;
        faceCtx.strokeStyle = coreWhite;
        faceCtx.lineWidth = 18;
        faceCtx.lineCap = 'round';
        faceCtx.beginPath();
        if (isWinkingThisEye) {
          faceCtx.moveTo(-60, 10);
          faceCtx.quadraticCurveTo(0, -38, 60, 10);
        } else {
          faceCtx.moveTo(-58, -4);
          faceCtx.quadraticCurveTo(0, 28, 58, -4);
        }
        faceCtx.stroke();
        faceCtx.restore();
        return;
      }

      if (isHappyArcEye && !isBlinking) {
        faceCtx.shadowColor = glowColor;
        faceCtx.shadowBlur = 32;
        faceCtx.strokeStyle = glowColor;
        faceCtx.lineWidth = 24;
        faceCtx.lineCap = 'round';
        faceCtx.beginPath();
        faceCtx.moveTo(-64, 20);
        faceCtx.quadraticCurveTo(0, -52, 64, 20);
        faceCtx.stroke();

        faceCtx.strokeStyle = coreWhite;
        faceCtx.lineWidth = 11;
        faceCtx.beginPath();
        faceCtx.moveTo(-58, 17);
        faceCtx.quadraticCurveTo(0, -46, 58, 17);
        faceCtx.stroke();
        faceCtx.restore();
        return;
      }

      let eyeW = 122;
      let eyeH = 136;
      if (state === 'LISTENING') {
        eyeW = 128 + micLevel * 12;
        eyeH = 146 + micLevel * 14;
      } else if (state === 'THINKING') {
        eyeH = 112;
      } else if (effectiveEmotion === 'curious' && side === -1) {
        eyeH = 106;
      }

      if (isBlinking) {
        eyeH = Math.max(10, eyeH * (1 - blinkProgress * 0.92));
      }

      // Outer phosphor glow
      faceCtx.shadowColor = glowColor;
      faceCtx.shadowBlur = 36 * currentCustom.eyeLuminescence;
      faceCtx.fillStyle = glowColor;
      drawRoundedRect(faceCtx, -eyeW / 2, -eyeH / 2, eyeW, eyeH, 52);
      faceCtx.fill();

      // Inner bright core
      faceCtx.shadowBlur = 14;
      faceCtx.fillStyle = coreWhite;
      drawRoundedRect(
        faceCtx,
        -eyeW * 0.42,
        -eyeH * 0.42,
        eyeW * 0.84,
        eyeH * 0.84,
        44
      );
      faceCtx.fill();

      if (eyeH > 40) {
        faceCtx.shadowBlur = 0;
        faceCtx.fillStyle = glowColor;
        faceCtx.beginPath();
        faceCtx.arc(smoothEyeX * 0.16, smoothEyeY * 0.16, 24, 0, Math.PI * 2);
        faceCtx.fill();

        // Dual specular catchlights
        faceCtx.fillStyle = '#ffffff';
        faceCtx.beginPath();
        faceCtx.arc(side * 18, -22, 12, 0, Math.PI * 2);
        faceCtx.fill();

        faceCtx.beginPath();
        faceCtx.arc(-side * 15, 20, 6, 0, Math.PI * 2);
        faceCtx.fill();

        // Warm lower-lid smile curve
        if (smoothSmile > 0.4 && state !== 'LISTENING') {
          faceCtx.fillStyle = '#070d1e';
          faceCtx.beginPath();
          faceCtx.ellipse(
            0,
            eyeH * 0.58,
            eyeW * 0.64,
            eyeH * 0.27 * smoothSmile,
            0,
            0,
            Math.PI * 2
          );
          faceCtx.fill();
        }
      }

      faceCtx.restore();
    };

    drawEye(-1);
    drawEye(1);

    // 3. Cheek Blushes / Acoustic Indicators
    for (const side of [-1, 1] as const) {
      const bx = W * 0.5 + side * 295 + smoothEyeX * 0.5;
      const by = H * 0.65 + smoothEyeY * 0.4;
      const blushGrad = faceCtx.createRadialGradient(bx, by, 2, bx, by, 48);
      if (state === 'LISTENING') {
        blushGrad.addColorStop(0, 'rgba(52, 211, 153, 0.45)');
      } else {
        blushGrad.addColorStop(0, softGlow);
      }
      blushGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      faceCtx.fillStyle = blushGrad;
      faceCtx.beginPath();
      faceCtx.arc(bx, by, 48, 0, Math.PI * 2);
      faceCtx.fill();
    }

    // 4. Expressive Smiling & Talking Mouth
    const mx = W * 0.5 + smoothEyeX * 0.45;
    const my = H * 0.74 + smoothEyeY * 0.35;

    faceCtx.save();
    faceCtx.translate(mx, my);
    faceCtx.shadowColor = glowColor;
    faceCtx.shadowBlur = 26 * currentCustom.eyeLuminescence;

    if (state === 'SPEAKING' || smoothMouthOpen > 0.045) {
      const mouthW = 74 + audio.midEnergy * 48 + smoothSmile * 18;
      const mouthH = Math.max(16, smoothMouthOpen * 82);

      faceCtx.fillStyle = '#040711';
      faceCtx.strokeStyle = coreWhite;
      faceCtx.lineWidth = 12;
      faceCtx.lineJoin = 'round';

      faceCtx.beginPath();
      faceCtx.moveTo(-mouthW, -mouthH * 0.18);
      faceCtx.quadraticCurveTo(0, mouthH * 0.12, mouthW, -mouthH * 0.18);
      faceCtx.bezierCurveTo(
        mouthW * 0.85,
        mouthH * 1.15,
        -mouthW * 0.85,
        mouthH * 1.15,
        -mouthW,
        -mouthH * 0.18
      );
      faceCtx.closePath();
      faceCtx.fill();
      faceCtx.stroke();

      // Harmonic vocalizer wave inside open mouth
      faceCtx.strokeStyle = glowColor;
      faceCtx.lineWidth = 6;
      faceCtx.beginPath();
      const waveSpan = mouthW * 0.68;
      for (let x = -waveSpan; x <= waveSpan; x += 8) {
        const norm = x / waveSpan;
        const env = 1 - norm * norm;
        const wy =
          mouthH * 0.35 +
          Math.sin(x * 0.12 + elapsed * 28) *
            (mouthH * 0.28 * env * (0.4 + audio.highEnergy));
        if (x === -waveSpan) faceCtx.moveTo(x, wy);
        else faceCtx.lineTo(x, wy);
      }
      faceCtx.stroke();
    } else if (state === 'THINKING' || effectiveEmotion === 'curious') {
      faceCtx.strokeStyle = coreWhite;
      faceCtx.lineWidth = 13;
      faceCtx.lineCap = 'round';
      faceCtx.beginPath();
      faceCtx.moveTo(-40, 4);
      faceCtx.quadraticCurveTo(-8, -10, 20, 6);
      faceCtx.quadraticCurveTo(36, 14, 50, -2);
      faceCtx.stroke();
    } else {
      // Unmistakable, warm welcoming smile!
      const smileWidth = effectiveEmotion === 'excited' ? 92 : 80;
      const smileDepth = effectiveEmotion === 'excited' ? 50 : 40;

      faceCtx.strokeStyle = glowColor;
      faceCtx.lineWidth = 20;
      faceCtx.lineCap = 'round';
      faceCtx.beginPath();
      faceCtx.moveTo(-smileWidth, -8);
      faceCtx.quadraticCurveTo(0, smileDepth, smileWidth, -8);
      faceCtx.stroke();

      faceCtx.strokeStyle = coreWhite;
      faceCtx.lineWidth = 10;
      faceCtx.beginPath();
      faceCtx.moveTo(-smileWidth + 3, -8);
      faceCtx.quadraticCurveTo(0, smileDepth - 2, smileWidth - 3, -8);
      faceCtx.stroke();
    }

    faceCtx.restore();
    faceTexture.needsUpdate = true;
  };

  // ==========================================================================
  // 8. CUSTOMIZATION & INTERACTIVE REACTION API
  // ==========================================================================
  const applyCustomization = (custom: CharacterCustomizationState) => {
    currentCustom = { ...custom };
    shellPrimaryMat.color.set(custom.hairPrimaryHex);
    trimAccentMat.color.set(custom.hairAccentHex);
    trimAccentMat.emissive.set(custom.hairAccentHex);

    shellSecondaryMat.color.set(custom.outfitJacketHex);
    darkChassisMat.color.set(custom.outlineHex);

    accentGlowMat.color.set(custom.cyberAccentHex);
    accentGlowMat.emissive.set(custom.cyberAccentHex);
    accentGlowMat.emissiveIntensity = custom.eyeLuminescence * 1.2;

    secondaryGlowMat.color.set(custom.auraRingHex);
    secondaryGlowMat.emissive.set(custom.auraRingHex);
    secondaryGlowMat.emissiveIntensity = custom.eyeLuminescence;

    plumeMat.color.set(custom.cyberAccentHex);
    baseRingMat.color.set(custom.auraRingHex);
    outerPulseMat.color.set(custom.cyberAccentHex);
  };

  let lastClockElapsed = 0;

  const setEmotion = (emotion: RobotEmotion) => {
    activeEmotion = emotion;
    reactionUntil = lastClockElapsed + 4.0;
    if (emotion === 'excited') {
      waveUntil = lastClockElapsed + 2.2;
    }
  };

  const triggerWaveOrReaction = (emotion?: RobotEmotion) => {
    if (emotion) {
      activeEmotion = emotion;
    } else {
      const cycle: RobotEmotion[] = ['excited', 'happy', 'wink', 'curious', 'zen'];
      const nextIdx = (cycle.indexOf(activeEmotion) + 1) % cycle.length;
      activeEmotion = cycle[nextIdx];
    }
    reactionUntil = lastClockElapsed + 3.5;
    waveUntil = lastClockElapsed + 2.2;
  };

  // ==========================================================================
  // 9. REAL-TIME 60FPS KINEMATICS & ANIMATION UPDATE LOOP
  // ==========================================================================
  let nextBlinkTime = 2.4;
  const blinkDuration = 0.15;

  const update = (
    elapsed: number,
    delta: number,
    state: CompanionState,
    audio: AudioReactiveMetrics,
    pointer: { x: number; y: number },
    micLevel: number
  ) => {
    lastClockElapsed = elapsed;
    const auraFreq = currentCustom.auraFrequency || 1.1;
    const isWaving = elapsed < waveUntil;

    // 1. Zero-Gravity Hover Bobbing + Interactive Joy Hop
    const hoverBob = Math.sin(elapsed * 2.2) * 0.032;
    const hopBoost = isWaving
      ? Math.abs(Math.sin((waveUntil - elapsed) * Math.PI * 2.5)) * 0.075
      : 0;
    torsoGroup.position.y = hoverBob + hopBoost;
    torsoGroup.rotation.z =
      Math.sin(elapsed * 1.1) * 0.02 - pointer.x * 0.032;
    torsoGroup.rotation.y = THREE.MathUtils.lerp(
      torsoGroup.rotation.y,
      pointer.x * 0.14,
      Math.min(1, delta * 5)
    );

    const plumeScale = 0.92 + Math.sin(elapsed * 18) * 0.08 + hopBoost * 1.5;
    plumeCone.scale.set(1, plumeScale, 1);
    thrusterRing1.scale.setScalar(0.95 + Math.sin(elapsed * 10) * 0.08);
    thrusterRing2.scale.setScalar(0.68 + Math.cos(elapsed * 10) * 0.08);

    // 2. Natural Blinking Schedule
    if (elapsed > nextBlinkTime + blinkDuration) {
      nextBlinkTime = elapsed + 2.8 + Math.random() * 3.2;
    }
    const isBlinking =
      elapsed >= nextBlinkTime && elapsed <= nextBlinkTime + blinkDuration;
    const blinkProgress = isBlinking
      ? 1 -
        Math.abs(
          (elapsed - (nextBlinkTime + blinkDuration / 2)) / (blinkDuration / 2)
        )
      : 0;

    // 3. Render 60fps OLED Visor Face
    renderVisorFace(
      elapsed,
      state,
      audio,
      pointer,
      micLevel,
      isBlinking,
      blinkProgress
    );

    // 4. State-Driven Head, Ear-Antenna, and Arm Kinematics
    let targetHeadRotX = -pointer.y * 0.2 + Math.sin(elapsed * 1.4) * 0.025;
    let targetHeadRotY = pointer.x * 0.3 + Math.cos(elapsed * 0.9) * 0.03;
    let targetHeadRotZ = Math.sin(elapsed * 1.1) * 0.032;

    let leftEarTilt = Math.sin(elapsed * 2.1) * 0.06;
    let rightEarTilt = -Math.sin(elapsed * 2.1) * 0.06;

    let leftShoulderX = 0.06;
    let leftShoulderZ = 0.2;
    let leftElbowX = -0.35;

    let rightShoulderX = 0.06;
    let rightShoulderZ = -0.2;
    let rightElbowX = -0.35;
    let rightHandZ = 0;

    if (isWaving) {
      targetHeadRotZ = 0.14;
      rightShoulderX = -0.95;
      rightShoulderZ = -0.42;
      rightElbowX = -1.1;
      rightHandZ = Math.sin(elapsed * 14) * 0.45;
      leftEarTilt = 0.25 + Math.sin(elapsed * 12) * 0.15;
      rightEarTilt = -0.25 - Math.sin(elapsed * 12) * 0.15;
    } else if (state === 'LISTENING') {
      targetHeadRotZ = 0.1 + Math.sin(elapsed * 2.5) * 0.02;
      targetHeadRotX = -0.05 - micLevel * 0.08;
      leftEarTilt = 0.26 + micLevel * 0.25;
      rightEarTilt = -0.26 - micLevel * 0.25;

      leftShoulderZ = 0.26;
      rightShoulderZ = -0.26;
      leftElbowX = -0.55;
      rightElbowX = -0.55;

      const pulse =
        1.0 + Math.sin(elapsed * 6.5 * auraFreq) * 0.1 + micLevel * 0.28;
      baseRing.scale.setScalar(pulse);
      baseRingMat.color.setHex(0x10b981);
      baseRingMat.opacity = 0.72;
      outerPulseRing.scale.setScalar(
        1.05 + Math.cos(elapsed * 5.5 * auraFreq) * 0.12
      );
      outerPulseMat.opacity = 0.5;
    } else if (state === 'THINKING') {
      targetHeadRotX = -0.16 + Math.sin(elapsed * 2.0) * 0.03;
      targetHeadRotY = 0.18 * Math.sin(elapsed * 1.2);
      targetHeadRotZ = -0.09;
      leftEarTilt = -0.14;
      rightEarTilt = 0.3;

      rightShoulderX = -0.58;
      rightShoulderZ = -0.05;
      rightElbowX = -1.35;

      baseRing.scale.setScalar(
        1.0 + Math.sin(elapsed * 4.0 * auraFreq) * 0.06
      );
      baseRingMat.color.setHex(0xa855f7);
      baseRingMat.opacity = 0.65;
      outerPulseMat.opacity = 0.42;
    } else if (state === 'SPEAKING') {
      const voiceAmp = audio.mouthOpen;
      targetHeadRotX =
        -pointer.y * 0.12 - voiceAmp * 0.09 + Math.sin(elapsed * 4.2) * 0.03;
      targetHeadRotY = pointer.x * 0.22 + Math.sin(elapsed * 2.4) * 0.065;
      targetHeadRotZ = Math.cos(elapsed * 2.8) * 0.05;

      leftEarTilt = voiceAmp * 0.3;
      rightEarTilt = -voiceAmp * 0.3;

      leftShoulderX = -0.26 - voiceAmp * 0.25;
      leftShoulderZ = 0.26 + audio.midEnergy * 0.12;
      leftElbowX = -0.7 - voiceAmp * 0.32;

      rightShoulderX = -0.3 - audio.lowEnergy * 0.28;
      rightShoulderZ = -0.26 - voiceAmp * 0.12;
      rightElbowX = -0.78 - audio.highEnergy * 0.32;

      const speakPulse = 1.0 + voiceAmp * 0.24;
      baseRing.scale.setScalar(speakPulse);
      baseRingMat.color.set(currentCustom.auraRingHex);
      baseRingMat.opacity = 0.58 + voiceAmp * 0.35;
      outerPulseRing.scale.setScalar(1.0 + audio.lowEnergy * 0.26);
      outerPulseMat.opacity = 0.32 + voiceAmp * 0.35;
    } else {
      baseRing.scale.setScalar(
        1.0 + Math.sin(elapsed * 2.0 * auraFreq) * 0.04
      );
      baseRingMat.color.set(currentCustom.auraRingHex);
      baseRingMat.opacity = 0.42;
      outerPulseRing.scale.setScalar(
        1.0 + Math.cos(elapsed * 1.6 * auraFreq) * 0.04
      );
      outerPulseMat.opacity = 0.22;
      baseRingGroup.rotation.y = elapsed * 0.35 * auraFreq;
    }

    const lerpFactor = Math.min(1, delta * 9.0);
    headGroup.rotation.x = THREE.MathUtils.lerp(
      headGroup.rotation.x,
      targetHeadRotX,
      lerpFactor
    );
    headGroup.rotation.y = THREE.MathUtils.lerp(
      headGroup.rotation.y,
      targetHeadRotY,
      lerpFactor
    );
    headGroup.rotation.z = THREE.MathUtils.lerp(
      headGroup.rotation.z,
      targetHeadRotZ,
      lerpFactor
    );

    leftEar.antennaPivot.rotation.z = THREE.MathUtils.lerp(
      leftEar.antennaPivot.rotation.z,
      leftEarTilt,
      lerpFactor
    );
    rightEar.antennaPivot.rotation.z = THREE.MathUtils.lerp(
      rightEar.antennaPivot.rotation.z,
      rightEarTilt,
      lerpFactor
    );

    leftArm.shoulderGroup.rotation.x = THREE.MathUtils.lerp(
      leftArm.shoulderGroup.rotation.x,
      leftShoulderX,
      lerpFactor
    );
    leftArm.shoulderGroup.rotation.z = THREE.MathUtils.lerp(
      leftArm.shoulderGroup.rotation.z,
      leftShoulderZ,
      lerpFactor
    );
    leftArm.elbowGroup.rotation.x = THREE.MathUtils.lerp(
      leftArm.elbowGroup.rotation.x,
      leftElbowX,
      lerpFactor
    );

    rightArm.shoulderGroup.rotation.x = THREE.MathUtils.lerp(
      rightArm.shoulderGroup.rotation.x,
      rightShoulderX,
      lerpFactor
    );
    rightArm.shoulderGroup.rotation.z = THREE.MathUtils.lerp(
      rightArm.shoulderGroup.rotation.z,
      rightShoulderZ,
      lerpFactor
    );
    rightArm.elbowGroup.rotation.x = THREE.MathUtils.lerp(
      rightArm.elbowGroup.rotation.x,
      rightElbowX,
      lerpFactor
    );
    rightArm.handGroup.rotation.z = THREE.MathUtils.lerp(
      rightArm.handGroup.rotation.z,
      rightHandZ,
      lerpFactor * 1.4
    );

    haloGroup.rotation.z = elapsed * 0.32 * auraFreq;
    coreMesh.rotation.y = elapsed * 1.8;
    coreMesh.rotation.x = elapsed * 1.1;
    gyroOuter.rotation.z = -elapsed * 1.4;
    gyroOuter.rotation.x = Math.sin(elapsed * 1.5) * 0.45;

    const baseLum = currentCustom.eyeLuminescence;
    const coreGlow =
      state === 'SPEAKING'
        ? baseLum * 1.35 + audio.mouthOpen * 1.5
        : baseLum + Math.sin(elapsed * 3.0 * auraFreq) * 0.25;
    accentGlowMat.emissiveIntensity = coreGlow;

    const showThinkingOrbit = state === 'THINKING';
    thinkingGroup.visible = showThinkingOrbit;
    if (showThinkingOrbit) {
      thinkingGroup.rotation.y = elapsed * 2.6;
      thinkingGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.16;
      orbitNodes.forEach((n, idx) => {
        n.position.y = Math.sin(elapsed * 4 + idx) * 0.05;
        n.rotation.x = elapsed * 3;
      });
    }
  };

  const dispose = () => {
    faceTexture.dispose();
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  };

  return {
    root,
    applyCustomization,
    setEmotion,
    triggerWaveOrReaction,
    update,
    dispose,
  };
}

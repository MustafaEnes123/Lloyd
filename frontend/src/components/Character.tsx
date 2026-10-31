import * as THREE from 'three';
import type { AudioReactiveMetrics, CompanionState } from '../hooks/useLloydSocket';

export interface CharacterController {
  root: THREE.Group;
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

function createToonGradientTexture(): THREE.DataTexture {
  const data = new Uint8Array([
    55, 55, 68, 255,
    125, 130, 150, 255,
    205, 212, 230, 255,
    255, 255, 255, 255,
  ]);
  const texture = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function addCelOutline(
  mesh: THREE.Mesh,
  thickness = 1.045,
  outlineColor = 0x050814
): THREE.Mesh {
  const outlineMat = new THREE.MeshBasicMaterial({
    color: outlineColor,
    side: THREE.BackSide,
  });
  const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMat);
  outlineMesh.scale.setScalar(thickness);
  mesh.add(outlineMesh);
  return outlineMesh;
}

export function createAnimeCompanion(): CharacterController {
  const root = new THREE.Group();
  root.position.set(0.35, -1.05, 0);

  const gradientMap = createToonGradientTexture();

  // Core Toon Materials
  const skinMat = new THREE.MeshToonMaterial({
    color: 0xffe9dc,
    gradientMap,
  });
  const hairMainMat = new THREE.MeshToonMaterial({
    color: 0xdbeafe,
    gradientMap,
  });
  const hairAccentMat = new THREE.MeshToonMaterial({
    color: 0x38bdf8,
    emissive: 0x0369a1,
    emissiveIntensity: 0.35,
    gradientMap,
  });
  const jacketMat = new THREE.MeshToonMaterial({
    color: 0x111827,
    gradientMap,
  });
  const innerShirtMat = new THREE.MeshToonMaterial({
    color: 0x1e293b,
    gradientMap,
  });
  const cyberTrimMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.8,
  });
  const magentaTrimMat = new THREE.MeshStandardMaterial({
    color: 0xff2a85,
    emissive: 0xff2a85,
    emissiveIntensity: 1.2,
    roughness: 0.25,
    metalness: 0.7,
  });

  // Body hierarchy groups
  const hipsGroup = new THREE.Group();
  hipsGroup.position.set(0, 1.05, 0);
  root.add(hipsGroup);

  const torsoGroup = new THREE.Group();
  hipsGroup.add(torsoGroup);

  // Upper Torso (Stylized Techwear Jacket)
  const chestGeo = new THREE.CylinderGeometry(0.27, 0.21, 0.72, 16);
  const chestMesh = new THREE.Mesh(chestGeo, jacketMat);
  chestMesh.position.set(0, 0.36, 0);
  chestMesh.castShadow = true;
  addCelOutline(chestMesh, 1.04);
  torsoGroup.add(chestMesh);

  // High Cyber Collar
  const collarGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.18, 16, 1, true);
  const collarMat = new THREE.MeshToonMaterial({
    color: 0x0f172a,
    side: THREE.DoubleSide,
    gradientMap,
  });
  const collarMesh = new THREE.Mesh(collarGeo, collarMat);
  collarMesh.position.set(0, 0.73, -0.01);
  torsoGroup.add(collarMesh);

  // Glowing Chest Reactor Core (Enes Custom Neural Core Emblem)
  const coreOuterGeo = new THREE.OctahedronGeometry(0.085, 1);
  const coreMesh = new THREE.Mesh(coreOuterGeo, cyberTrimMat);
  coreMesh.position.set(0, 0.46, 0.24);
  coreMesh.scale.set(1, 1.25, 0.45);
  torsoGroup.add(coreMesh);

  // Jacket Neon Lapel Strips
  const stripGeo = new THREE.BoxGeometry(0.022, 0.56, 0.02);
  const leftStrip = new THREE.Mesh(stripGeo, cyberTrimMat);
  leftStrip.position.set(-0.12, 0.38, 0.23);
  leftStrip.rotation.z = 0.08;
  torsoGroup.add(leftStrip);

  const rightStrip = new THREE.Mesh(stripGeo, cyberTrimMat);
  rightStrip.position.set(0.12, 0.38, 0.23);
  rightStrip.rotation.z = -0.08;
  torsoGroup.add(rightStrip);

  // Neck
  const neckGeo = new THREE.CylinderGeometry(0.095, 0.11, 0.2, 14);
  const neckMesh = new THREE.Mesh(neckGeo, skinMat);
  neckMesh.position.set(0, 0.78, 0);
  addCelOutline(neckMesh, 1.05);
  torsoGroup.add(neckMesh);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.06, 0.02);
  torsoGroup.add(headGroup);

  // Sculpted Anime Cranium + Jawline
  const craniumGeo = new THREE.SphereGeometry(0.29, 28, 24);
  craniumGeo.scale(0.95, 1.04, 0.96);
  const craniumMesh = new THREE.Mesh(craniumGeo, skinMat);
  craniumMesh.castShadow = true;
  addCelOutline(craniumMesh, 1.038);
  headGroup.add(craniumMesh);

  // Anime Chin taper
  const chinGeo = new THREE.ConeGeometry(0.22, 0.26, 20);
  const chinMesh = new THREE.Mesh(chinGeo, skinMat);
  chinMesh.rotation.x = Math.PI;
  chinMesh.position.set(0, -0.15, 0.04);
  chinMesh.scale.set(0.95, 0.85, 0.88);
  headGroup.add(chinMesh);

  // Subtle Anime Nose
  const noseGeo = new THREE.ConeGeometry(0.025, 0.065, 8);
  const noseMesh = new THREE.Mesh(noseGeo, skinMat);
  noseMesh.rotation.x = Math.PI * 0.42;
  noseMesh.position.set(0, -0.03, 0.285);
  headGroup.add(noseMesh);

  // Ears + Cyber Ear-Cuffs
  const earGeo = new THREE.SphereGeometry(0.055, 12, 12);
  earGeo.scale(0.45, 1.15, 0.7);
  const leftEar = new THREE.Mesh(earGeo, skinMat);
  leftEar.position.set(-0.275, -0.02, -0.01);
  headGroup.add(leftEar);

  const rightEar = new THREE.Mesh(earGeo, skinMat);
  rightEar.position.set(0.275, -0.02, -0.01);
  headGroup.add(rightEar);

  const cuffGeo = new THREE.TorusGeometry(0.038, 0.01, 8, 18);
  const leftCuff = new THREE.Mesh(cuffGeo, cyberTrimMat);
  leftCuff.position.set(-0.29, 0.01, -0.01);
  leftCuff.rotation.y = Math.PI / 2;
  headGroup.add(leftCuff);

  const rightCuff = new THREE.Mesh(cuffGeo, magentaTrimMat);
  rightCuff.position.set(0.29, 0.01, -0.01);
  rightCuff.rotation.y = Math.PI / 2;
  headGroup.add(rightCuff);

  // Expressive Anime Eyes (Left & Right)
  const createAnimeEye = (side: -1 | 1) => {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(side * 0.105, 0.025, 0.248);
    eyeGroup.rotation.y = side * 0.16;

    // Sclera
    const scleraGeo = new THREE.SphereGeometry(0.058, 18, 16);
    scleraGeo.scale(1.12, 1.25, 0.35);
    const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sclera = new THREE.Mesh(scleraGeo, scleraMat);
    eyeGroup.add(sclera);

    // Vibrant Cyan/Indigo Iris
    const irisGroup = new THREE.Group();
    const irisGeo = new THREE.CircleGeometry(0.044, 24);
    const irisMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.z = 0.021;
    iris.scale.set(0.95, 1.15, 1);
    irisGroup.add(iris);

    // Lower Glowing Cyan Iris Crescent
    const glowIrisGeo = new THREE.CircleGeometry(0.034, 20);
    const glowIrisMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const glowIris = new THREE.Mesh(glowIrisGeo, glowIrisMat);
    glowIris.position.set(0, -0.006, 0.022);
    irisGroup.add(glowIris);

    // Dark Pupil
    const pupilGeo = new THREE.CircleGeometry(0.019, 16);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x090d16 });
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(0, 0.002, 0.023);
    pupil.scale.set(0.9, 1.15, 1);
    irisGroup.add(pupil);

    // Dual Anime Specular Catchlights
    const specMainGeo = new THREE.CircleGeometry(0.011, 12);
    const specMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const specMain = new THREE.Mesh(specMainGeo, specMat);
    specMain.position.set(side * 0.014, 0.018, 0.024);
    irisGroup.add(specMain);

    const specSubGeo = new THREE.CircleGeometry(0.0055, 10);
    const specSub = new THREE.Mesh(specSubGeo, specMat);
    specSub.position.set(-side * 0.012, -0.014, 0.024);
    irisGroup.add(specSub);

    eyeGroup.add(irisGroup);

    // Upper Eyelash Line
    const lashGeo = new THREE.BoxGeometry(0.115, 0.016, 0.02);
    const lashMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const lash = new THREE.Mesh(lashGeo, lashMat);
    lash.position.set(0, 0.068, 0.02);
    lash.rotation.z = -side * 0.06;
    eyeGroup.add(lash);

    // Blink Eyelid Cover
    const lidGeo = new THREE.SphereGeometry(0.061, 16, 14);
    lidGeo.scale(1.15, 1.28, 0.38);
    const lidMesh = new THREE.Mesh(lidGeo, skinMat);
    lidMesh.position.z = 0.003;
    lidMesh.scale.y = 0.01;
    lidMesh.visible = false;
    eyeGroup.add(lidMesh);

    // Expressive Eyebrow
    const browGeo = new THREE.BoxGeometry(0.11, 0.014, 0.018);
    const browMat = new THREE.MeshBasicMaterial({ color: 0x475569 });
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(0, 0.105, 0.022);
    brow.rotation.z = -side * 0.08;
    eyeGroup.add(brow);

    headGroup.add(eyeGroup);
    return { eyeGroup, irisGroup, lidMesh, brow, lash };
  };

  const leftEye = createAnimeEye(-1);
  const rightEye = createAnimeEye(1);

  // Articulated Mouth & Vocal Lip-Sync Cavity
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.115, 0.262);
  headGroup.add(mouthGroup);

  const mouthSmileLineGeo = new THREE.BoxGeometry(0.075, 0.009, 0.01);
  const mouthLineMat = new THREE.MeshBasicMaterial({ color: 0x7c2d12 });
  const mouthLine = new THREE.Mesh(mouthSmileLineGeo, mouthLineMat);
  mouthGroup.add(mouthLine);

  const mouthCavityGeo = new THREE.SphereGeometry(0.036, 16, 12);
  mouthCavityGeo.scale(1.15, 0.85, 0.35);
  const mouthCavityMat = new THREE.MeshBasicMaterial({ color: 0x991b1b });
  const mouthCavity = new THREE.Mesh(mouthCavityGeo, mouthCavityMat);
  mouthCavity.scale.set(0.8, 0.05, 1);
  mouthGroup.add(mouthCavity);

  // Tongue accent inside mouth cavity
  const tongueGeo = new THREE.SphereGeometry(0.022, 12, 10);
  const tongueMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
  const tongueMesh = new THREE.Mesh(tongueGeo, tongueMat);
  tongueMesh.position.set(0, -0.008, 0.006);
  mouthCavity.add(tongueMesh);

  // Stylized Multi-Layered Anime Hair
  const hairGroup = new THREE.Group();
  headGroup.add(hairGroup);

  // Hair Base Cap
  const hairCapGeo = new THREE.SphereGeometry(0.308, 24, 20);
  hairCapGeo.scale(0.98, 1.05, 1.0);
  const hairCap = new THREE.Mesh(hairCapGeo, hairMainMat);
  hairCap.position.set(0, 0.05, -0.025);
  addCelOutline(hairCap, 1.03);
  hairGroup.add(hairCap);

  // Procedural Spiky Anime Hair Locks (Front bangs, side swept locks, crown spikes)
  const hairSpikes: { mesh: THREE.Mesh; baseRotZ: number; baseRotX: number; phase: number }[] = [];
  const createHairSpike = (
    radius: number,
    height: number,
    pos: [number, number, number],
    rot: [number, number, number],
    isAccent = false
  ) => {
    const geo = new THREE.ConeGeometry(radius, height, 6);
    geo.translate(0, -height * 0.42, 0);
    const mat = isAccent ? hairAccentMat : hairMainMat;
    const spike = new THREE.Mesh(geo, mat);
    spike.position.set(...pos);
    spike.rotation.set(...rot);
    spike.castShadow = true;
    addCelOutline(spike, 1.045);
    hairGroup.add(spike);
    hairSpikes.push({
      mesh: spike,
      baseRotZ: rot[2],
      baseRotX: rot[0],
      phase: Math.random() * Math.PI * 2,
    });
  };

  // Forehead Bangs
  createHairSpike(0.068, 0.27, [0.0, 0.27, 0.23], [0.22, 0, -0.08], true);
  createHairSpike(0.062, 0.25, [-0.085, 0.26, 0.21], [0.2, 0, 0.22], false);
  createHairSpike(0.062, 0.26, [0.09, 0.26, 0.21], [0.2, 0, -0.24], false);
  createHairSpike(0.058, 0.29, [-0.18, 0.22, 0.16], [0.15, 0.2, 0.35], true);
  createHairSpike(0.058, 0.29, [0.18, 0.22, 0.16], [0.15, -0.2, -0.35], false);

  // Side Framing Locks
  createHairSpike(0.065, 0.34, [-0.25, 0.14, 0.08], [0.08, 0.3, 0.28], false);
  createHairSpike(0.065, 0.34, [0.25, 0.14, 0.08], [0.08, -0.3, -0.28], true);

  // Crown & Back Anime Spikes
  createHairSpike(0.085, 0.32, [0.0, 0.35, -0.02], [-2.4, 0, 0.15], false);
  createHairSpike(0.08, 0.3, [-0.14, 0.33, -0.06], [-2.2, 0.3, 0.45], true);
  createHairSpike(0.08, 0.3, [0.14, 0.33, -0.06], [-2.2, -0.3, -0.45], false);
  createHairSpike(0.075, 0.28, [-0.22, 0.24, -0.14], [-1.7, 0.4, 0.65], false);
  createHairSpike(0.075, 0.28, [0.22, 0.24, -0.14], [-1.7, -0.4, -0.65], false);
  createHairSpike(0.07, 0.26, [0.0, 0.15, -0.27], [-0.45, 0, 0], false);

  // Articulated Arms & Hands
  const createArm = (side: -1 | 1) => {
    const shoulderGroup = new THREE.Group();
    shoulderGroup.position.set(side * 0.31, 0.63, 0);
    torsoGroup.add(shoulderGroup);

    // Shoulder Pauldron Accent
    const pauldronGeo = new THREE.SphereGeometry(0.085, 14, 12);
    const pauldron = new THREE.Mesh(pauldronGeo, jacketMat);
    addCelOutline(pauldron, 1.05);
    shoulderGroup.add(pauldron);

    // Upper Arm
    const upperArmGeo = new THREE.CylinderGeometry(0.068, 0.058, 0.34, 12);
    const upperArm = new THREE.Mesh(upperArmGeo, jacketMat);
    upperArm.position.set(0, -0.17, 0);
    addCelOutline(upperArm, 1.05);
    shoulderGroup.add(upperArm);

    // Elbow & Forearm Group
    const elbowGroup = new THREE.Group();
    elbowGroup.position.set(0, -0.34, 0);
    shoulderGroup.add(elbowGroup);

    const forearmGeo = new THREE.CylinderGeometry(0.056, 0.046, 0.31, 12);
    const forearm = new THREE.Mesh(forearmGeo, innerShirtMat);
    forearm.position.set(0, -0.15, 0);
    addCelOutline(forearm, 1.05);
    elbowGroup.add(forearm);

    // Glowing Cyber Wristband
    const wristGeo = new THREE.TorusGeometry(0.05, 0.009, 8, 18);
    const wristBand = new THREE.Mesh(wristGeo, cyberTrimMat);
    wristBand.rotation.x = Math.PI / 2;
    wristBand.position.set(0, -0.28, 0);
    elbowGroup.add(wristBand);

    // Hand
    const handGeo = new THREE.SphereGeometry(0.052, 12, 12);
    handGeo.scale(0.85, 1.15, 0.65);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(0, -0.34, 0.01);
    addCelOutline(hand, 1.05);
    elbowGroup.add(hand);

    return { shoulderGroup, elbowGroup };
  };

  const leftArm = createArm(-1);
  const rightArm = createArm(1);

  // Lower Body / Legs standing on pedestal
  const pelvisGeo = new THREE.CylinderGeometry(0.21, 0.19, 0.22, 14);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, innerShirtMat);
  pelvisMesh.position.set(0, -0.08, 0);
  addCelOutline(pelvisMesh, 1.04);
  hipsGroup.add(pelvisMesh);

  const createLeg = (side: -1 | 1) => {
    const legGeo = new THREE.CylinderGeometry(0.082, 0.062, 0.92, 12);
    const legMesh = new THREE.Mesh(legGeo, jacketMat);
    legMesh.position.set(side * 0.11, -0.56, 0);
    addCelOutline(legMesh, 1.04);
    hipsGroup.add(legMesh);
  };
  createLeg(-1);
  createLeg(1);

  // Floating Cyber Halo Ring behind Lloyd's upper back
  const haloGroup = new THREE.Group();
  haloGroup.position.set(0, 0.65, -0.28);
  torsoGroup.add(haloGroup);

  const haloRingGeo = new THREE.TorusGeometry(0.38, 0.008, 12, 48);
  const haloRing = new THREE.Mesh(haloRingGeo, cyberTrimMat);
  haloGroup.add(haloRing);

  // 6 Floating Energy Shards around Halo
  const shards: THREE.Mesh[] = [];
  const shardGeo = new THREE.OctahedronGeometry(0.032, 0);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const shard = new THREE.Mesh(shardGeo, i % 2 === 0 ? cyberTrimMat : magentaTrimMat);
    shard.position.set(Math.cos(angle) * 0.46, Math.sin(angle) * 0.46, 0);
    shard.scale.set(0.6, 1.8, 0.6);
    shard.rotation.z = angle;
    haloGroup.add(shard);
    shards.push(shard);
  }

  // Base Glowing Telemetry Ring (pulses during LISTENING / SPEAKING)
  const baseRingGroup = new THREE.Group();
  baseRingGroup.position.set(0, 0.03, 0);
  root.add(baseRingGroup);

  const baseRingGeo = new THREE.RingGeometry(0.56, 0.61, 64);
  const baseRingMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.45,
  });
  const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
  baseRing.rotation.x = -Math.PI / 2;
  baseRingGroup.add(baseRing);

  const outerPulseGeo = new THREE.RingGeometry(0.66, 0.685, 64);
  const outerPulseMat = new THREE.MeshBasicMaterial({
    color: 0xff2a85,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.25,
  });
  const outerPulseRing = new THREE.Mesh(outerPulseGeo, outerPulseMat);
  outerPulseRing.rotation.x = -Math.PI / 2;
  baseRingGroup.add(outerPulseRing);

  // Orbiting Thinking Particle Ring (active during THINKING state)
  const thinkingGroup = new THREE.Group();
  thinkingGroup.position.set(0, 2.25, 0);
  root.add(thinkingGroup);

  const orbitNodes: THREE.Mesh[] = [];
  const nodeGeo = new THREE.OctahedronGeometry(0.028, 0);
  for (let i = 0; i < 8; i++) {
    const node = new THREE.Mesh(nodeGeo, i % 2 === 0 ? cyberTrimMat : magentaTrimMat);
    const a = (i / 8) * Math.PI * 2;
    node.position.set(Math.cos(a) * 0.48, Math.sin(a * 2) * 0.06, Math.sin(a) * 0.48);
    thinkingGroup.add(node);
    orbitNodes.push(node);
  }

  // Blink state tracking (random blinks every 3-6 seconds)
  let nextBlinkTime = 2.8;
  let blinkDuration = 0.14;

  const update = (
    elapsed: number,
    delta: number,
    state: CompanionState,
    audio: AudioReactiveMetrics,
    pointer: { x: number; y: number },
    micLevel: number
  ) => {
    // 1. Subtle Breathing & Posture
    const breath = Math.sin(elapsed * 2.1) * 0.016;
    torsoGroup.position.y = breath;
    torsoGroup.scale.set(1 + breath * 0.4, 1, 1 + breath * 0.4);

    // 2. Blinking every 3 - 6 seconds
    if (elapsed > nextBlinkTime + blinkDuration) {
      nextBlinkTime = elapsed + 3.0 + Math.random() * 3.0;
    }
    const isBlinking = elapsed >= nextBlinkTime && elapsed <= nextBlinkTime + blinkDuration;
    leftEye.lidMesh.visible = isBlinking;
    rightEye.lidMesh.visible = isBlinking;
    if (isBlinking) {
      const blinkProgress =
        1 - Math.abs((elapsed - (nextBlinkTime + blinkDuration / 2)) / (blinkDuration / 2));
      const lidScale = Math.max(0.1, blinkProgress * 1.28);
      leftEye.lidMesh.scale.y = lidScale;
      rightEye.lidMesh.scale.y = lidScale;
    }

    // 3. State-Driven Head, Eye, Brow, Arm, and Ring Animations
    let targetHeadRotX = -pointer.y * 0.18 + Math.sin(elapsed * 0.9) * 0.03;
    let targetHeadRotY = pointer.x * 0.28 + Math.cos(elapsed * 0.6) * 0.04;
    let targetHeadRotZ = Math.sin(elapsed * 0.7) * 0.035;
    let targetEyeScaleY = 1.0;
    let targetBrowY = 0.105;
    let targetBrowTilt = 0.08;

    let leftShoulderX = 0.08;
    let leftShoulderZ = 0.14;
    let leftElbowX = -0.25;
    let rightShoulderX = 0.08;
    let rightShoulderZ = -0.14;
    let rightElbowX = -0.25;

    if (state === 'LISTENING') {
      // Perks up, head cocks slightly, eyes widen, glowing base ring pulses
      targetHeadRotZ = 0.12 + Math.sin(elapsed * 2.5) * 0.025;
      targetHeadRotX = -0.05 - micLevel * 0.08;
      targetEyeScaleY = 1.14 + micLevel * 0.12;
      targetBrowY = 0.118;
      targetBrowTilt = 0.02;

      leftShoulderZ = 0.18;
      rightShoulderZ = -0.18;
      leftElbowX = -0.42;
      rightElbowX = -0.42;

      const pulse = 1.0 + Math.sin(elapsed * 7.5) * 0.12 + micLevel * 0.35;
      baseRing.scale.setScalar(pulse);
      baseRingMat.color.setHex(0x10b981);
      baseRingMat.opacity = 0.75 + Math.sin(elapsed * 8) * 0.2;
      outerPulseRing.scale.setScalar(1.05 + Math.cos(elapsed * 6) * 0.15);
      outerPulseMat.opacity = 0.55;
    } else if (state === 'THINKING') {
      // Glances upward and ponders, floating particle ring orbits
      targetHeadRotX = -0.16 + Math.sin(elapsed * 2.0) * 0.03;
      targetHeadRotY = 0.18 * Math.sin(elapsed * 1.1);
      targetHeadRotZ = -0.08;
      targetBrowY = 0.112;
      targetBrowTilt = 0.14;

      rightShoulderX = -0.58;
      rightShoulderZ = -0.08;
      rightElbowX = -1.35;

      baseRing.scale.setScalar(1.0 + Math.sin(elapsed * 4.0) * 0.06);
      baseRingMat.color.setHex(0xa855f7);
      baseRingMat.opacity = 0.65;
      outerPulseMat.opacity = 0.45;
    } else if (state === 'SPEAKING') {
      // Expressive head & hand gestures synced to voice cadence
      const voiceAmp = audio.mouthOpen;
      targetHeadRotX = -pointer.y * 0.12 - voiceAmp * 0.09 + Math.sin(elapsed * 4.2) * 0.03;
      targetHeadRotY = pointer.x * 0.2 + Math.sin(elapsed * 2.4) * 0.07;
      targetHeadRotZ = Math.cos(elapsed * 2.8) * 0.05;
      targetBrowY = 0.108 + voiceAmp * 0.015;

      leftShoulderX = -0.22 - voiceAmp * 0.25;
      leftShoulderZ = 0.22 + audio.midEnergy * 0.12;
      leftElbowX = -0.68 - voiceAmp * 0.35;

      rightShoulderX = -0.28 - audio.lowEnergy * 0.28;
      rightShoulderZ = -0.22 - voiceAmp * 0.12;
      rightElbowX = -0.75 - audio.highEnergy * 0.35;

      const speakPulse = 1.0 + voiceAmp * 0.28;
      baseRing.scale.setScalar(speakPulse);
      baseRingMat.color.setHex(0x00f0ff);
      baseRingMat.opacity = 0.6 + voiceAmp * 0.38;
      outerPulseRing.scale.setScalar(1.0 + audio.lowEnergy * 0.32);
      outerPulseMat.opacity = 0.35 + voiceAmp * 0.4;
    } else {
      // IDLE state
      baseRing.scale.setScalar(1.0 + Math.sin(elapsed * 2.0) * 0.03);
      baseRingMat.color.setHex(0x00f0ff);
      baseRingMat.opacity = 0.36;
      outerPulseRing.scale.setScalar(1.0 + Math.cos(elapsed * 1.6) * 0.03);
      outerPulseMat.opacity = 0.18;
    }

    const lerpFactor = Math.min(1, delta * 8.5);
    headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, targetHeadRotX, lerpFactor);
    headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, targetHeadRotY, lerpFactor);
    headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, targetHeadRotZ, lerpFactor);

    // Subtle iris tracking toward cursor
    const irisOffsetX = THREE.MathUtils.clamp(pointer.x * 0.012, -0.012, 0.012);
    const irisOffsetY = THREE.MathUtils.clamp(pointer.y * 0.01, -0.01, 0.01);
    leftEye.irisGroup.position.x = THREE.MathUtils.lerp(leftEye.irisGroup.position.x, irisOffsetX, lerpFactor);
    leftEye.irisGroup.position.y = THREE.MathUtils.lerp(leftEye.irisGroup.position.y, irisOffsetY, lerpFactor);
    rightEye.irisGroup.position.x = THREE.MathUtils.lerp(rightEye.irisGroup.position.x, irisOffsetX, lerpFactor);
    rightEye.irisGroup.position.y = THREE.MathUtils.lerp(rightEye.irisGroup.position.y, irisOffsetY, lerpFactor);

    leftEye.eyeGroup.scale.y = THREE.MathUtils.lerp(leftEye.eyeGroup.scale.y, targetEyeScaleY, lerpFactor);
    rightEye.eyeGroup.scale.y = THREE.MathUtils.lerp(rightEye.eyeGroup.scale.y, targetEyeScaleY, lerpFactor);

    leftEye.brow.position.y = THREE.MathUtils.lerp(leftEye.brow.position.y, targetBrowY, lerpFactor);
    rightEye.brow.position.y = THREE.MathUtils.lerp(rightEye.brow.position.y, targetBrowY, lerpFactor);
    leftEye.brow.rotation.z = THREE.MathUtils.lerp(leftEye.brow.rotation.z, targetBrowTilt, lerpFactor);
    rightEye.brow.rotation.z = THREE.MathUtils.lerp(rightEye.brow.rotation.z, -targetBrowTilt, lerpFactor);

    // 4. Real-Time Mouth & Jaw Lip-Sync Morphing
    const openAmount = state === 'SPEAKING' ? Math.max(0.06, audio.mouthOpen) : 0.0;
    if (openAmount > 0.03) {
      mouthCavity.visible = true;
      const mouthWidth = 0.85 + audio.midEnergy * 0.45;
      const mouthHeight = Math.min(1.45, 0.15 + openAmount * 1.35);
      mouthCavity.scale.set(mouthWidth, mouthHeight, 1);
      mouthLine.scale.x = 0.6 + openAmount * 0.5;
      mouthLine.position.y = openAmount * 0.022;
      chinMesh.position.y = -0.15 - openAmount * 0.028;
    } else {
      mouthCavity.visible = false;
      mouthLine.scale.x = 1.0;
      mouthLine.position.y = 0;
      chinMesh.position.y = -0.15;
    }

    // 5. Arm Articulation
    leftArm.shoulderGroup.rotation.x = THREE.MathUtils.lerp(leftArm.shoulderGroup.rotation.x, leftShoulderX, lerpFactor);
    leftArm.shoulderGroup.rotation.z = THREE.MathUtils.lerp(leftArm.shoulderGroup.rotation.z, leftShoulderZ, lerpFactor);
    leftArm.elbowGroup.rotation.x = THREE.MathUtils.lerp(leftArm.elbowGroup.rotation.x, leftElbowX, lerpFactor);

    rightArm.shoulderGroup.rotation.x = THREE.MathUtils.lerp(rightArm.shoulderGroup.rotation.x, rightShoulderX, lerpFactor);
    rightArm.shoulderGroup.rotation.z = THREE.MathUtils.lerp(rightArm.shoulderGroup.rotation.z, rightShoulderZ, lerpFactor);
    rightArm.elbowGroup.rotation.x = THREE.MathUtils.lerp(rightArm.elbowGroup.rotation.x, rightElbowX, lerpFactor);

    // 6. Hair Secondary Motion Sway
    for (const h of hairSpikes) {
      h.mesh.rotation.z = h.baseRotZ + Math.sin(elapsed * 2.2 + h.phase) * 0.028;
      h.mesh.rotation.x = h.baseRotX + Math.cos(elapsed * 1.8 + h.phase) * 0.02;
    }

    // 7. Cyber Halo & Thinking Particle Orbit
    haloGroup.rotation.z = elapsed * 0.35;
    coreMesh.rotation.y = elapsed * 1.4;
    const coreGlow = state === 'SPEAKING' ? 1.8 + audio.mouthOpen * 1.5 : 1.2 + Math.sin(elapsed * 3) * 0.25;
    cyberTrimMat.emissiveIntensity = coreGlow;

    const showThinkingOrbit = state === 'THINKING';
    thinkingGroup.visible = showThinkingOrbit;
    if (showThinkingOrbit) {
      thinkingGroup.rotation.y = elapsed * 2.6;
      thinkingGroup.rotation.z = Math.sin(elapsed * 1.5) * 0.18;
      orbitNodes.forEach((n, idx) => {
        n.position.y = Math.sin(elapsed * 4 + idx) * 0.07;
        n.rotation.x = elapsed * 3;
      });
    }
  };

  const dispose = () => {
    gradientMap.dispose();
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

  return { root, update, dispose };
}

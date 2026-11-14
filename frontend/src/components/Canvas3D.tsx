import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AudioReactiveMetrics, CompanionState } from '../hooks/useLloydSocket';
import type { CharacterCustomizationState, RobotEmotion } from '../types/customization';
import { createAnimeCompanion, type CharacterController } from './Character';

interface Canvas3DProps {
  companionState: CompanionState;
  audioMetrics: AudioReactiveMetrics;
  micLevel: number;
  customization: CharacterCustomizationState;
  isOnboarding: boolean;
  activeEmotion?: RobotEmotion;
  cameraPreset?: 'default' | 'closeup' | 'wide';
  onRobotInteract?: () => void;
}

const NEBULA_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldDirection;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldDirection = normalize(worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const NEBULA_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vWorldDirection;
  uniform float uTime;
  uniform vec3 uNebulaPrimary;
  uniform vec3 uNebulaSecondary;
  uniform float uExposure;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 5; ++i) {
      v += a * noise(p);
      p = p * 2.02 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDirection);

    // Rich cosmic deep-space midnight base
    vec3 baseSpace = vec3(0.014, 0.024, 0.052);

    // Diagonal Milky Way galactic band
    float galacticPlane = 1.0 - smoothstep(0.0, 0.72, abs(dir.y * 0.78 - dir.x * 0.42 + 0.05));

    vec3 coord = dir * 2.6 + vec3(uTime * 0.005, -uTime * 0.003, 0.0);
    float n1 = fbm(coord);
    float n2 = fbm(coord * 2.1 + vec3(n1 * 1.8));
    float cloudMask = smoothstep(0.22, 0.76, n1 * 0.6 + n2 * 0.55);

    vec3 colPrimary = uNebulaPrimary * 0.55;
    vec3 colSecondary = uNebulaSecondary * 0.45;
    vec3 cosmicViolet = vec3(0.28, 0.16, 0.55) * 0.35;
    vec3 warmStardust = vec3(0.95, 0.68, 0.42) * 0.28;

    vec3 nebula = mix(colSecondary, colPrimary, smoothstep(0.25, 0.75, n2));
    nebula = mix(nebula, cosmicViolet, smoothstep(0.35, 0.8, n1) * 0.45);
    nebula += warmStardust * pow(max(0.0, n1 * n2 * 1.4), 2.0) * galacticPlane;

    // Dark cosmic dust lanes inside the galactic core
    float dustLane = smoothstep(0.46, 0.72, fbm(dir * 5.2 + vec3(3.7)));
    float attenuation = mix(1.0, 0.35, dustLane * galacticPlane * 0.8);

    vec3 finalColor = baseSpace + nebula * cloudMask * (0.45 + 0.95 * galacticPlane) * attenuation * uExposure;
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const STAR_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vTwinkle;
  uniform float uTime;

  void main() {
    vColor = aColor;
    float twinkle = 0.76 + 0.24 * sin(uTime * 2.5 + aPhase);
    vTwinkle = twinkle;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * twinkle * (310.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const STAR_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord.xy - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    float core = smoothstep(0.2, 0.0, d);
    float halo = pow(max(0.0, 1.0 - d * 2.0), 2.4) * 0.75;
    float alpha = (core + halo) * vTwinkle;

    vec3 col = mix(vColor, vec3(1.0), core * 0.8);
    gl_FragColor = vec4(col, alpha);
  }
`;

const PLANET_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vLocalPos;

  void main() {
    vLocalPos = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PLANET_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vLocalPos;
  uniform vec3 uSunDirection;
  uniform vec3 uAtmosphereColor;
  uniform float uTime;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; ++i) {
      v += a * noise(p);
      p = p * 2.05 + vec3(42.0);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 sunDir = normalize(uSunDirection);

    float ndotl = dot(normal, sunDir);
    float dayFactor = smoothstep(-0.2, 0.45, ndotl);

    // Smooth zonal atmospheric bands stretched along latitude
    vec3 p = normalize(vLocalPos);
    vec3 stretchedCoord = vec3(p.x * 2.2 + uTime * 0.012, p.y * 11.0, p.z * 2.2);
    float turbulence = fbm(stretchedCoord);
    float zones = sin(p.y * 18.0 + turbulence * 3.2) * 0.5 + 0.5;

    vec3 deepBand = vec3(0.05, 0.13, 0.28);
    vec3 midBand = vec3(0.12, 0.28, 0.48);
    vec3 highClouds = vec3(0.68, 0.84, 0.96);

    vec3 surface = mix(deepBand, midBand, smoothstep(0.2, 0.8, zones));
    surface = mix(surface, highClouds, smoothstep(0.55, 0.88, turbulence) * 0.55);

    vec3 nightSide = vec3(0.01, 0.016, 0.035);
    vec3 litPlanet = mix(nightSide, surface, dayFactor);

    // Rayleigh atmospheric horizon scattering
    float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 3.0);
    float sunRim = smoothstep(-0.35, 0.65, ndotl);
    vec3 atmosphere = uAtmosphereColor * fresnel * (0.4 + 0.95 * sunRim);

    gl_FragColor = vec4(litPlanet + atmosphere, 1.0);
  }
`;

export const Canvas3D: React.FC<Canvas3DProps> = ({
  companionState,
  audioMetrics,
  micLevel,
  customization,
  isOnboarding,
  activeEmotion,
  cameraPreset = 'default',
  onRobotInteract,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<CompanionState>(companionState);
  const audioRef = useRef<AudioReactiveMetrics>(audioMetrics);
  const micRef = useRef<number>(micLevel);
  const customRef = useRef<CharacterCustomizationState>(customization);
  const onboardingRef = useRef<boolean>(isOnboarding);
  const cameraPresetRef = useRef<'default' | 'closeup' | 'wide'>(cameraPreset);
  const companionRef = useRef<CharacterController | null>(null);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const interactCallbackRef = useRef<(() => void) | undefined>(onRobotInteract);

  useEffect(() => {
    stateRef.current = companionState;
  }, [companionState]);

  useEffect(() => {
    audioRef.current = audioMetrics;
  }, [audioMetrics]);

  useEffect(() => {
    micRef.current = micLevel;
  }, [micLevel]);

  useEffect(() => {
    onboardingRef.current = isOnboarding;
  }, [isOnboarding]);

  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
  }, [cameraPreset]);

  useEffect(() => {
    interactCallbackRef.current = onRobotInteract;
  }, [onRobotInteract]);

  useEffect(() => {
    customRef.current = customization;
    if (companionRef.current) {
      companionRef.current.applyCustomization(customization);
    }
  }, [customization]);

  useEffect(() => {
    if (activeEmotion && companionRef.current) {
      companionRef.current.setEmotion(activeEmotion);
    }
  }, [activeEmotion]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getWidth = () => container.clientWidth || window.innerWidth || 1280;
    const getHeight = () => container.clientHeight || window.innerHeight || 800;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040711);

    const camera = new THREE.PerspectiveCamera(
      34,
      getWidth() / getHeight(),
      0.1,
      120
    );
    // Start slightly further out for smooth entry zoom into the centered robot
    camera.position.set(0.0, 0.42, 4.1);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setSize(getWidth(), getHeight());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.minDistance = 2.15;
    controls.maxDistance = 4.6;
    controls.minPolarAngle = 1.12;
    controls.maxPolarAngle = 1.68;
    controls.minAzimuthAngle = -0.65;
    controls.maxAzimuthAngle = 0.65;
    // Target centered vertically at y = 0.22 so the entire robot fits comfortably between top and bottom UI bars
    controls.target.set(0.0, 0.22, 0.0);
    controls.update();

    // ========================================================================
    // 1. STUDIO & ORBITAL STARLIGHT LIGHTING SETUP
    // ========================================================================
    const ambientLight = new THREE.HemisphereLight(
      0xe0f2fe,
      0x090d16,
      1.05 * customRef.current.roomAmbientIntensity
    );
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xf8fafc, 2.4);
    keyLight.position.set(2.6, 3.8, 3.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 12;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLightLeft = new THREE.PointLight(
      new THREE.Color(customRef.current.roomRimLightHex),
      4.2,
      10
    );
    rimLightLeft.position.set(-2.2, 1.5, -1.5);
    scene.add(rimLightLeft);

    const rimLightRight = new THREE.PointLight(
      new THREE.Color(customRef.current.auraRingHex),
      3.5,
      10
    );
    rimLightRight.position.set(2.2, 1.2, -1.6);
    scene.add(rimLightRight);

    const underGlowLight = new THREE.PointLight(
      new THREE.Color(customRef.current.cyberAccentHex),
      1.8,
      5
    );
    underGlowLight.position.set(0.0, -0.6, 0.8);
    scene.add(underGlowLight);

    // ========================================================================
    // 2. DEEP-SPACE NEBULA & MILKY WAY SKY DOME
    // ========================================================================
    const nebulaUniforms = {
      uTime: { value: 0 },
      uNebulaPrimary: { value: new THREE.Color(customRef.current.roomRimLightHex) },
      uNebulaSecondary: { value: new THREE.Color(customRef.current.auraRingHex) },
      uExposure: { value: customRef.current.roomAmbientIntensity },
    };

    const skyDomeGeo = new THREE.SphereGeometry(48, 48, 32);
    const skyDomeMat = new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERTEX_SHADER,
      fragmentShader: NEBULA_FRAGMENT_SHADER,
      uniforms: nebulaUniforms,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
    scene.add(skyDome);

    // ========================================================================
    // 3. MULTI-TIER REALISTIC STARFIELD (4,500 STARS WITH SPECTRAL COLORS)
    // ========================================================================
    const starCount = 4500;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starPhases = new Float32Array(starCount);

    const spectralPalette = [
      new THREE.Color('#bfd7ff'),
      new THREE.Color('#e2e8f0'),
      new THREE.Color('#f8fafc'),
      new THREE.Color('#fef3c7'),
      new THREE.Color('#fde68a'),
      new THREE.Color('#fecdd3'),
    ];

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const radius = 16 + Math.random() * 26;

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);

      const color =
        spectralPalette[
          Math.floor(Math.pow(Math.random(), 1.4) * spectralPalette.length)
        ];
      starColors[i * 3] = color.r;
      starColors[i * 3 + 1] = color.g;
      starColors[i * 3 + 2] = color.b;

      const mag = Math.pow(Math.random(), 2.8);
      starSizes[i] = 0.75 + mag * 3.4;
      starPhases[i] = Math.random() * Math.PI * 2;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
    starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));

    const starUniforms = {
      uTime: { value: 0 },
    };

    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      uniforms: starUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // ========================================================================
    // 4. PHOTOREALISTIC RINGED EXOPLANET & ATMOSPHERIC LIMB IN DEEP ORBIT
    // ========================================================================
    const cosmosGroup = new THREE.Group();
    scene.add(cosmosGroup);

    const planetUniforms = {
      uSunDirection: { value: new THREE.Vector3(1.0, 0.55, 0.65).normalize() },
      uAtmosphereColor: { value: new THREE.Color(customRef.current.roomRimLightHex) },
      uTime: { value: 0 },
    };

    const planetGeo = new THREE.SphereGeometry(3.2, 64, 48);
    const planetMat = new THREE.ShaderMaterial({
      vertexShader: PLANET_VERTEX_SHADER,
      fragmentShader: PLANET_FRAGMENT_SHADER,
      uniforms: planetUniforms,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetMesh.position.set(-5.4, -1.6, -15.5);
    cosmosGroup.add(planetMesh);

    const ringCanvas = document.createElement('canvas');
    ringCanvas.width = 512;
    ringCanvas.height = 32;
    const rCtx = ringCanvas.getContext('2d')!;
    const ringGrad = rCtx.createLinearGradient(0, 0, 512, 0);
    ringGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    ringGrad.addColorStop(0.15, 'rgba(186, 230, 253, 0.28)');
    ringGrad.addColorStop(0.32, 'rgba(224, 242, 254, 0.52)');
    ringGrad.addColorStop(0.45, 'rgba(15, 23, 42, 0.04)');
    ringGrad.addColorStop(0.52, 'rgba(186, 230, 253, 0.42)');
    ringGrad.addColorStop(0.78, 'rgba(148, 163, 184, 0.18)');
    ringGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    rCtx.fillStyle = ringGrad;
    rCtx.fillRect(0, 0, 512, 32);

    const ringTex = new THREE.CanvasTexture(ringCanvas);
    const planetRingGeo = new THREE.RingGeometry(4.1, 7.5, 96);
    const posAttr = planetRingGeo.attributes.position;
    const uvAttr = planetRingGeo.attributes.uv;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const r = Math.sqrt(vx * vx + vy * vy);
      const u = (r - 4.1) / (7.5 - 4.1);
      uvAttr.setXY(i, u, 0.5);
    }
    const planetRingMat = new THREE.MeshBasicMaterial({
      map: ringTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const planetRing = new THREE.Mesh(planetRingGeo, planetRingMat);
    planetRing.position.copy(planetMesh.position);
    planetRing.rotation.x = Math.PI * 0.41;
    planetRing.rotation.y = -0.28;
    cosmosGroup.add(planetRing);

    const moonGeo = new THREE.SphereGeometry(0.62, 36, 36);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.85,
      metalness: 0.1,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(5.2, 2.2, -14.0);
    cosmosGroup.add(moonMesh);

    // ========================================================================
    // 5. MINIMALIST ZERO-G ORBITAL PLATFORM ANCHORING LLOYD AT CENTER (X = 0)
    // ========================================================================
    const platformGroup = new THREE.Group();
    platformGroup.position.set(0, -0.62, 0);
    scene.add(platformGroup);

    const padGeo = new THREE.CylinderGeometry(0.68, 0.78, 0.05, 64);
    const padMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b101d,
      roughness: 0.25,
      metalness: 0.82,
      clearcoat: 0.6,
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.receiveShadow = true;
    platformGroup.add(padMesh);

    const padRimGeo = new THREE.TorusGeometry(0.7, 0.007, 12, 64);
    const padRimMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(customRef.current.cyberAccentHex),
      transparent: true,
      opacity: 0.5,
    });
    const padRim = new THREE.Mesh(padRimGeo, padRimMat);
    padRim.rotation.x = Math.PI / 2;
    padRim.position.y = 0.028;
    platformGroup.add(padRim);

    const dustCount = 90;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 9;
      dustPositions[i * 3 + 1] = Math.random() * 4.5 - 1.2;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 0.5;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: new THREE.Color(customRef.current.roomRimLightHex),
      size: 0.022,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);

    // ========================================================================
    // 6. INSTANTIATE CENTERED HERO ROBOT COMPANION (LLOYD)
    // ========================================================================
    const companion = createAnimeCompanion(customRef.current);
    companionRef.current = companion;
    scene.add(companion.root);

    const raycaster = new THREE.Raycaster();
    const pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos.x = e.clientX;
      pointerDownPos.y = e.clientY;
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (dist > 6) return;

      const rect = container.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / w) * 2 - 1,
        -((e.clientY - rect.top) / h) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(companion.root.children, true);
      if (hits.length > 0) {
        companion.triggerWaveOrReaction();
        interactCallbackRef.current?.();
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      const nx = ((e.clientX - rect.left) / w) * 2 - 1;
      const ny = -((e.clientY - rect.top) / h) * 2 + 1;
      pointerRef.current = { x: nx, y: ny };
    };

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);

    const handleResize = () => {
      if (!container) return;
      const w = getWidth();
      const h = getHeight();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => handleResize())
        : null;
    resizeObserver?.observe(container);

    let hasCompletedEntryTransition = false;
    let lastAppliedPreset: 'default' | 'closeup' | 'wide' = 'default';
    const clock = new THREE.Clock();
    let rafId = 0;

    const animate = () => {
      const delta = Math.min(0.1, clock.getDelta());
      const elapsed = clock.getElapsedTime();

      if (!onboardingRef.current && !hasCompletedEntryTransition) {
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, 3.25, delta * 3.0);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.34, delta * 3.0);
        if (Math.abs(camera.position.z - 3.25) < 0.03) {
          hasCompletedEntryTransition = true;
        }
      } else if (
        hasCompletedEntryTransition &&
        cameraPresetRef.current !== lastAppliedPreset
      ) {
        const targetZ =
          cameraPresetRef.current === 'closeup'
            ? 2.45
            : cameraPresetRef.current === 'wide'
            ? 3.95
            : 3.25;
        camera.position.z = THREE.MathUtils.lerp(
          camera.position.z,
          targetZ,
          delta * 4.5
        );
        if (Math.abs(camera.position.z - targetZ) < 0.02) {
          lastAppliedPreset = cameraPresetRef.current;
        }
      }

      controls.update();

      companion.update(
        elapsed,
        delta,
        stateRef.current,
        audioRef.current,
        pointerRef.current,
        micRef.current
      );

      const c = customRef.current;
      nebulaUniforms.uTime.value = elapsed;
      nebulaUniforms.uNebulaPrimary.value.set(c.roomRimLightHex);
      nebulaUniforms.uNebulaSecondary.value.set(c.auraRingHex);
      nebulaUniforms.uExposure.value = c.roomAmbientIntensity;

      starUniforms.uTime.value = elapsed;
      planetUniforms.uTime.value = elapsed;
      planetUniforms.uAtmosphereColor.value.set(c.roomRimLightHex);

      starField.rotation.y = elapsed * 0.0045;
      dustParticles.rotation.y = elapsed * 0.018;
      dustParticles.position.y = Math.sin(elapsed * 0.45) * 0.06;

      ambientLight.intensity = 1.05 * c.roomAmbientIntensity;
      rimLightLeft.color.set(c.roomRimLightHex);
      rimLightRight.color.set(c.auraRingHex);
      underGlowLight.color.set(c.cyberAccentHex);
      padRimMat.color.set(c.cyberAccentHex);
      dustMat.color.set(c.roomRimLightHex);

      const voiceBoost =
        stateRef.current === 'SPEAKING' ? audioRef.current.mouthOpen * 2.2 : 0;
      rimLightLeft.intensity = (3.8 + voiceBoost) * c.roomAmbientIntensity;
      underGlowLight.intensity = (1.6 + voiceBoost * 0.9) * c.roomAmbientIntensity;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      companion.dispose();
      companionRef.current = null;
      skyDomeGeo.dispose();
      skyDomeMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      planetGeo.dispose();
      planetMat.dispose();
      planetRingGeo.dispose();
      planetRingMat.dispose();
      ringTex.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing"
      aria-label="Lloyd 3D Deep Space Orbital Viewport"
    />
  );
};

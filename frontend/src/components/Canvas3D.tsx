import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AudioReactiveMetrics, CompanionState } from '../hooks/useLloydSocket';
import type { CharacterCustomizationState } from '../types/customization';
import { createAnimeCompanion, type CharacterController } from './Character';

interface Canvas3DProps {
  companionState: CompanionState;
  audioMetrics: AudioReactiveMetrics;
  micLevel: number;
  customization: CharacterCustomizationState;
  isOnboarding: boolean;
}

export const Canvas3D: React.FC<Canvas3DProps> = ({
  companionState,
  audioMetrics,
  micLevel,
  customization,
  isOnboarding,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<CompanionState>(companionState);
  const audioRef = useRef<AudioReactiveMetrics>(audioMetrics);
  const micRef = useRef<number>(micLevel);
  const customRef = useRef<CharacterCustomizationState>(customization);
  const onboardingRef = useRef<boolean>(isOnboarding);
  const companionRef = useRef<CharacterController | null>(null);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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
    customRef.current = customization;
    if (companionRef.current) {
      companionRef.current.applyCustomization(customization);
    }
  }, [customization]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050814);
    scene.fog = new THREE.FogExp2(0x050814, 0.095);

    const camera = new THREE.PerspectiveCamera(
      36,
      container.clientWidth / container.clientHeight,
      0.1,
      50
    );
    // Start slightly further out for smooth cinematic zoom-in
    camera.position.set(0.05, 0.95, 4.15);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.minDistance = 2.15;
    controls.maxDistance = 4.4;
    controls.minPolarAngle = 1.12;
    controls.maxPolarAngle = 1.66;
    controls.minAzimuthAngle = -0.58;
    controls.maxAzimuthAngle = 0.58;
    controls.target.set(0.14, 0.52, 0);
    controls.update();

    // Lighting Setup
    const ambientLight = new THREE.HemisphereLight(
      0xcbd5e1,
      0x0f172a,
      0.85 * customRef.current.roomAmbientIntensity
    );
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.1);
    keyLight.position.set(2.4, 3.8, 2.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 12;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const cyanRimLight = new THREE.PointLight(
      new THREE.Color(customRef.current.roomRimLightHex),
      3.6,
      8
    );
    cyanRimLight.position.set(-1.6, 1.8, -1.2);
    scene.add(cyanRimLight);

    const magentaRimLight = new THREE.PointLight(
      new THREE.Color(customRef.current.auraRingHex),
      3.2,
      8
    );
    magentaRimLight.position.set(2.2, 1.5, -1.4);
    scene.add(magentaRimLight);

    const underGlowLight = new THREE.PointLight(
      new THREE.Color(customRef.current.cyberAccentHex),
      1.5,
      4
    );
    underGlowLight.position.set(0.35, -0.8, 0.6);
    scene.add(underGlowLight);

    // Cyber-Loft Digital Simulation Environment
    const envGroup = new THREE.Group();
    scene.add(envGroup);

    const floorGeo = new THREE.CircleGeometry(9, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080c18,
      roughness: 0.25,
      metalness: 0.65,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -1.05;
    floorMesh.receiveShadow = true;
    envGroup.add(floorMesh);

    const grid = new THREE.GridHelper(14, 28, 0x00f2fe, 0x1e293b);
    grid.position.y = -1.045;
    const gridMat = grid.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.26;
    envGroup.add(grid);

    // Character Cyber Pedestal
    const pedestalGeo = new THREE.CylinderGeometry(0.76, 0.86, 0.08, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.8,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.set(0.35, -1.01, 0);
    pedestal.receiveShadow = true;
    envGroup.add(pedestal);

    // Architectural Cyber-Loft Back Monoliths & Neon Pillars
    const monolithGeo = new THREE.BoxGeometry(0.9, 4.5, 0.18);
    const monolithMat = new THREE.MeshStandardMaterial({
      color: 0x0b1120,
      roughness: 0.4,
      metalness: 0.7,
    });
    const neonPrimaryMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(customRef.current.cyberAccentHex),
    });
    const neonSecondaryMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(customRef.current.auraRingHex),
    });

    const pillarPositions = [-2.4, -1.1, 0.35, 1.75, 3.0];
    pillarPositions.forEach((px, idx) => {
      const panel = new THREE.Mesh(monolithGeo, monolithMat);
      panel.position.set(px, 1.1, -2.6 - Math.abs(idx - 2) * 0.25);
      envGroup.add(panel);

      const trimGeo = new THREE.BoxGeometry(0.025, 4.2, 0.2);
      const trim = new THREE.Mesh(
        trimGeo,
        idx % 2 === 0 ? neonPrimaryMat : neonSecondaryMat
      );
      trim.position.set(px + 0.46, 1.1, panel.position.z);
      envGroup.add(trim);
    });

    // Floating Cozy Cyber-Loft Data Rack on Left Side
    const rackGroup = new THREE.Group();
    rackGroup.position.set(-1.35, 0.15, -1.25);
    rackGroup.rotation.y = 0.35;
    envGroup.add(rackGroup);

    for (let s = 0; s < 3; s++) {
      const shelfGeo = new THREE.BoxGeometry(0.95, 0.035, 0.32);
      const shelf = new THREE.Mesh(shelfGeo, pedestalMat);
      shelf.position.y = s * 0.52 - 0.4;
      rackGroup.add(shelf);

      const holoBarGeo = new THREE.BoxGeometry(0.92, 0.012, 0.015);
      const holoBar = new THREE.Mesh(
        holoBarGeo,
        s % 2 === 0 ? neonPrimaryMat : neonSecondaryMat
      );
      holoBar.position.set(0, s * 0.52 - 0.4, 0.165);
      rackGroup.add(holoBar);
    }

    // Ambient Floating Cyber Particles
    const particleCount = 130;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = Math.random() * 4 - 0.9;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 0.5;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: new THREE.Color(customRef.current.roomRimLightHex),
      size: 0.028,
      transparent: true,
      opacity: 0.55,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Instantiate the 3D Anime Companion (Lloyd)
    const companion = createAnimeCompanion(customRef.current);
    companionRef.current = companion;
    scene.add(companion.root);

    let hasCompletedEntryTransition = false;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      pointerRef.current = { x: nx, y: ny };
    };
    window.addEventListener('pointermove', handlePointerMove);

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let rafId = 0;

    const animate = () => {
      const delta = Math.min(0.1, clock.getDelta());
      const elapsed = clock.getElapsedTime();

      // Seamless camera entry transition into cyber-loft once onboarding completes
      if (!onboardingRef.current && !hasCompletedEntryTransition) {
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, 3.22, delta * 3.2);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.72, delta * 3.2);
        if (Math.abs(camera.position.z - 3.22) < 0.03) {
          hasCompletedEntryTransition = true;
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

      // Sync room lighting and neon pillars with live customization state
      const c = customRef.current;
      ambientLight.intensity = 0.85 * c.roomAmbientIntensity;
      cyanRimLight.color.set(c.roomRimLightHex);
      magentaRimLight.color.set(c.auraRingHex);
      underGlowLight.color.set(c.cyberAccentHex);
      neonPrimaryMat.color.set(c.cyberAccentHex);
      neonSecondaryMat.color.set(c.auraRingHex);
      particleMat.color.set(c.roomRimLightHex);

      particles.rotation.y = elapsed * 0.03;
      particles.position.y = Math.sin(elapsed * 0.4) * 0.06;

      const voiceBoost = stateRef.current === 'SPEAKING' ? audioRef.current.mouthOpen * 2.2 : 0;
      cyanRimLight.intensity = (3.4 + voiceBoost) * c.roomAmbientIntensity;
      underGlowLight.intensity = (1.4 + voiceBoost * 0.8) * c.roomAmbientIntensity;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      companion.dispose();
      companionRef.current = null;
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing"
      aria-label="Lloyd 3D Cyber-Loft Simulation Viewport"
    />
  );
};

export type HairPresetId =
  | 'silver'
  | 'obsidian'
  | 'cyber_cyan'
  | 'sakura_pink'
  | 'electric_gold';

export type RobotEmotion =
  | 'happy'
  | 'excited'
  | 'curious'
  | 'wink'
  | 'zen';

export interface CharacterCustomizationState {
  hairPreset: HairPresetId;
  hairPrimaryHex: string; // Primary Chassis Shell Finish
  hairAccentHex: string;  // Secondary Chassis Trim / Ear-Pod Finish
  eyeIrisHex: string;     // OLED Visor Eye & Smile Phosphor Color
  eyeLuminescence: number; // 0.5 - 2.5 (OLED Visor & Core Luminance)
  outfitJacketHex: string; // Inner Frame & Torso Armor Color
  cyberAccentHex: string;  // Reactor Core & Thruster Accent
  outlineHex: string;      // Panel Seam & Rim Shadow Tone
  auraRingHex: string;     // Orbital Containment Ring & Nebula Accent
  auraFrequency: number;   // 0.5 - 2.5 (Orbital & Thruster Pulse Rate)
  roomRimLightHex: string; // Deep Space Rim & Planetary Atmosphere Tint
  roomAmbientIntensity: number; // 0.4 - 1.8 (Starlight & Nebula Exposure)
}

export const HAIR_PALETTES: Record<
  HairPresetId,
  {
    label: string;
    subtitle: string;
    primary: string;
    accent: string;
    jacket: string;
    eye: string;
    swatch: string;
  }
> = {
  silver: {
    label: 'Lunar Titanium',
    subtitle: 'Aerospace Ceramic & Sky Blue',
    primary: '#f1f5f9',
    accent: '#38bdf8',
    jacket: '#1e293b',
    eye: '#38bdf8',
    swatch: 'from-slate-100 via-slate-300 to-sky-400',
  },
  obsidian: {
    label: 'Stealth Carbon',
    subtitle: 'Matte Obsidian & Indigo Core',
    primary: '#1e2430',
    accent: '#818cf8',
    jacket: '#0f131a',
    eye: '#60a5fa',
    swatch: 'from-zinc-800 via-slate-800 to-indigo-400',
  },
  cyber_cyan: {
    label: 'Orbital Cobalt',
    subtitle: 'Deep Azure & Electric Cyan',
    primary: '#e0f2fe',
    accent: '#00f2fe',
    jacket: '#0f172a',
    eye: '#00f2fe',
    swatch: 'from-sky-100 via-cyan-300 to-blue-500',
  },
  sakura_pink: {
    label: 'Crimson Nova',
    subtitle: 'Warm Alabaster & Coral Rose',
    primary: '#fdf2f8',
    accent: '#fb7185',
    jacket: '#1f1624',
    eye: '#fda4af',
    swatch: 'from-rose-100 via-pink-300 to-rose-500',
  },
  electric_gold: {
    label: 'Solar Voyager',
    subtitle: 'Champagne Alloy & Amber Gold',
    primary: '#fefce8',
    accent: '#f59e0b',
    jacket: '#1c1917',
    eye: '#fbbf24',
    swatch: 'from-amber-100 via-yellow-300 to-amber-500',
  },
};

export const DEFAULT_CUSTOMIZATION: CharacterCustomizationState = {
  hairPreset: 'silver',
  hairPrimaryHex: '#f1f5f9',
  hairAccentHex: '#38bdf8',
  eyeIrisHex: '#38bdf8',
  eyeLuminescence: 1.45,
  outfitJacketHex: '#182030',
  cyberAccentHex: '#38bdf8',
  outlineHex: '#090d16',
  auraRingHex: '#60a5fa',
  auraFrequency: 1.1,
  roomRimLightHex: '#38bdf8',
  roomAmbientIntensity: 1.05,
};

const STORAGE_KEY = 'lloyd_customization_v3';

export function loadCustomizationState(): CharacterCustomizationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOMIZATION;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CUSTOMIZATION, ...parsed };
  } catch {
    return DEFAULT_CUSTOMIZATION;
  }
}

export function saveCustomizationState(state: CharacterCustomizationState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

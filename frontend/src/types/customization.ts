export type HairPresetId =
  | 'silver'
  | 'obsidian'
  | 'cyber_cyan'
  | 'sakura_pink'
  | 'electric_gold';

export interface CharacterCustomizationState {
  hairPreset: HairPresetId;
  hairPrimaryHex: string;
  hairAccentHex: string;
  eyeIrisHex: string;
  eyeLuminescence: number; // 0.5 - 2.5
  outfitJacketHex: string;
  cyberAccentHex: string;
  outlineHex: string;
  auraRingHex: string;
  auraFrequency: number; // 0.5 - 2.5
  roomRimLightHex: string;
  roomAmbientIntensity: number; // 0.4 - 1.8
}

export const HAIR_PALETTES: Record<
  HairPresetId,
  { label: string; primary: string; accent: string; swatch: string }
> = {
  silver: {
    label: 'Silver Frost',
    primary: '#dbeafe',
    accent: '#38bdf8',
    swatch: 'from-slate-100 to-sky-400',
  },
  obsidian: {
    label: 'Obsidian Void',
    primary: '#1e293b',
    accent: '#6366f1',
    swatch: 'from-slate-800 to-indigo-500',
  },
  cyber_cyan: {
    label: 'Cyber Cyan',
    primary: '#00f2fe',
    accent: '#4facfe',
    swatch: 'from-cyan-300 to-blue-500',
  },
  sakura_pink: {
    label: 'Sakura Pink',
    primary: '#f9a8d4',
    accent: '#f43f5e',
    swatch: 'from-pink-300 to-rose-500',
  },
  electric_gold: {
    label: 'Electric Gold',
    primary: '#fef08a',
    accent: '#f59e0b',
    swatch: 'from-yellow-200 to-amber-500',
  },
};

export const DEFAULT_CUSTOMIZATION: CharacterCustomizationState = {
  hairPreset: 'silver',
  hairPrimaryHex: '#dbeafe',
  hairAccentHex: '#00f2fe',
  eyeIrisHex: '#00f2fe',
  eyeLuminescence: 1.4,
  outfitJacketHex: '#0f172a',
  cyberAccentHex: '#00f2fe',
  outlineHex: '#050814',
  auraRingHex: '#4facfe',
  auraFrequency: 1.2,
  roomRimLightHex: '#4facfe',
  roomAmbientIntensity: 1.0,
};

const STORAGE_KEY = 'lloyd_customization_v2';

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

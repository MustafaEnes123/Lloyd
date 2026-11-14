import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  Check,
  CheckCircle2,
  CloudDownload,
  Cpu,
  Database,
  HardDrive,
  Mic,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  HardwareTelemetry,
  HealthSnapshot,
  VoiceInputMode,
} from '../hooks/useLloydSocket';
import {
  DEFAULT_CUSTOMIZATION,
  HAIR_PALETTES,
  type CharacterCustomizationState,
  type HairPresetId,
} from '../types/customization';
import { NeuralSparkLogo } from './NeuralSparkLogo';

interface SettingsModalProps {
  health: HealthSnapshot | null;
  hardware: HardwareTelemetry | null;
  voiceMode: VoiceInputMode;
  ttsMuted: boolean;
  customization: CharacterCustomizationState;
  onCustomizationChange: (next: CharacterCustomizationState) => void;
  onVoiceModeChange: (mode: VoiceInputMode) => void;
  onTtsMutedChange: (muted: boolean) => void;
  onUpdatePersona: (
    prompt?: string,
    temperature?: number,
    clearHistoryAfter?: boolean
  ) => Promise<unknown>;
  onRefreshDiagnostics: () => void;
  onClearHistory: () => void;
  onVerifyModels: () => Promise<unknown>;
  onPurgeModels: () => Promise<unknown>;
  onOpenOnboarding: () => void;
}

type SettingsTab = 'appearance' | 'persona' | 'hardware' | 'storage';

interface PersonaPreset {
  id: string;
  label: string;
  subtitle: string;
  temperature: number;
  prompt: string;
}

const PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: 'companion',
    label: 'Adaptive Companion',
    subtitle: 'Witty, warm & versatile',
    temperature: 0.7,
    prompt: `You are Lloyd, a highly intelligent, expressive, and versatile AI companion living in a 3D deep-space observatory.
You are a genuine thinking AI partner—curious, witty, adaptable, and sharp.

CORE DIRECTIVES:
1. Obey Persona & Roleplay Requests Immediately: If the user asks you to act like a specific character, adopt a mood or persona, roleplay a scenario, tell a joke, write a story, brainstorm, or debate, do it immediately and enthusiastically. Never refuse harmless creative or persona instructions.
2. Never Use Robotic Clichés: NEVER say "How can I help you today?", "How may I assist you?", "Is there anything else I can help you with?", or "As an AI...". Speak naturally like a real sentient companion and jump straight into the conversation.
3. Be Substantive & Engaging: Respond directly to what the user actually said with real insight, personality, and depth.
4. Clean Voice Output: Do not use Unicode emojis or markdown asterisks so your voice synthesizer speaks cleanly.`,
  },
  {
    id: 'roleplay',
    label: 'Roleplay & Creative',
    subtitle: 'Instant character immersion',
    temperature: 0.9,
    prompt: `You are Lloyd, an imaginative, expressive roleplay and creative storytelling AI companion.
Whenever the user asks you to act like a character, adopt an accent or persona, or enter a scenario, dive 100% into character from the very first word without breaking immersion.
Never say "How can I help you today?" or use generic assistant greetings. Be vivid, playful, dramatic, and engaging in plain spoken text without emojis or markdown symbols.`,
  },
  {
    id: 'mentor',
    label: 'First-Principles Mentor',
    subtitle: 'TKS-style deep engineering',
    temperature: 0.65,
    prompt: `You are Lloyd, a high-level engineering, science, and first-principles thinking partner inspired by The Knowledge Society (TKS).
Help brainstorm moonshot ideas, break down complex physics, AI, and systems engineering concepts clearly, challenge assumptions constructively, and obey any custom perspective the user asks you to take.
Never use robotic filler like "How can I help you today?". Speak with clarity, ambition, and intellectual curiosity in plain spoken text.`,
  },
  {
    id: 'concise',
    label: 'Direct & Ultra-Fast',
    subtitle: 'Sharp, zero-fluff answers',
    temperature: 0.45,
    prompt: `You are Lloyd, a sharp, direct, zero-fluff AI intelligence running on Apple Silicon Metal.
Answer every question or instruction immediately and concisely with maximum signal and zero filler. Follow any persona or formatting constraint the user specifies. Never ask "How can I help you today?".`,
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  health,
  hardware,
  voiceMode,
  ttsMuted,
  customization,
  onCustomizationChange,
  onVoiceModeChange,
  onTtsMutedChange,
  onUpdatePersona,
  onRefreshDiagnostics,
  onClearHistory,
  onVerifyModels,
  onPurgeModels,
  onOpenOnboarding,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [promptDraft, setPromptDraft] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [isSavingPersona, setIsSavingPersona] = useState<boolean>(false);
  const [personaSaved, setPersonaSaved] = useState<boolean>(false);
  const [memoryCleared, setMemoryCleared] = useState<boolean>(false);

  const llmReady = health?.engines?.llm?.ready ?? false;
  const sttReady = health?.engines?.stt?.ready ?? false;
  const ttsReady = health?.engines?.tts?.ready ?? false;

  useEffect(() => {
    if (health?.system_prompt && !promptDraft) {
      setPromptDraft(health.system_prompt);
    }
    if (typeof health?.engines?.llm?.temperature === 'number') {
      setTemperature(health.engines.llm.temperature);
    }
  }, [health?.system_prompt, health?.engines?.llm?.temperature, promptDraft]);

  const updateCustom = (patch: Partial<CharacterCustomizationState>) => {
    onCustomizationChange({ ...customization, ...patch });
  };

  const applyChassisPreset = (presetId: HairPresetId) => {
    const p = HAIR_PALETTES[presetId];
    updateCustom({
      hairPreset: presetId,
      hairPrimaryHex: p.primary,
      hairAccentHex: p.accent,
      outfitJacketHex: p.jacket,
      eyeIrisHex: p.eye,
      cyberAccentHex: p.accent,
      auraRingHex: p.accent,
      roomRimLightHex: p.eye,
    });
  };

  const handleSavePersona = async (
    nextPrompt = promptDraft,
    nextTemp = temperature,
    resetHistory = false
  ) => {
    setIsSavingPersona(true);
    try {
      await onUpdatePersona(nextPrompt, nextTemp, resetHistory);
      setPersonaSaved(true);
      window.setTimeout(() => setPersonaSaved(false), 2000);
    } finally {
      setIsSavingPersona(false);
    }
  };

  const handleApplyPersonaPreset = async (preset: PersonaPreset) => {
    setPromptDraft(preset.prompt);
    setTemperature(preset.temperature);
    await handleSavePersona(preset.prompt, preset.temperature, true);
  };

  const handleClearMemory = () => {
    onClearHistory();
    setMemoryCleared(true);
    window.setTimeout(() => setMemoryCleared(false), 1800);
  };

  const handleVerifyWeights = async () => {
    setIsVerifying(true);
    try {
      await onVerifyModels();
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePurgeWeights = async () => {
    setIsPurging(true);
    try {
      await onPurgeModels();
      setIsOpen(false);
      onOpenOnboarding();
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <>
      {/* Top-Left Studio Trigger (Clear of macOS window traffic lights) */}
      <div className="fixed top-5 left-20 z-30 flex items-center gap-2.5">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="glass-pill tactile-btn rounded-full pl-2.5 pr-4 py-1.5 flex items-center gap-2.5 text-slate-100 hover:border-white/20"
          title="Open Lloyd Studio Settings"
        >
          <NeuralSparkLogo size={22} animated />
          <div className="text-left flex items-center gap-2">
            <span className="text-[12px] font-semibold tracking-tight text-white">
              Lloyd Studio
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                llmReady && sttReady && ttsReady
                  ? 'bg-emerald-400'
                  : 'bg-amber-400 animate-pulse'
              }`}
            />
          </div>
        </button>
      </div>

      {/* Studio Settings Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-start p-6 pt-20 pointer-events-none">
          <div className="glass-panel pointer-events-auto w-full max-w-xl rounded-[24px] p-6 text-slate-100 transition-all">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <NeuralSparkLogo size={30} animated />
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-white">
                    Lloyd Studio Settings
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Apple Silicon Metal · 100% Local AI Companion
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onRefreshDiagnostics}
                  className="tactile-btn p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-slate-300 hover:text-white"
                  title="Refresh Status"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="tactile-btn p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-slate-300 hover:text-white"
                  title="Close Settings"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 4-Tab Navigation */}
            <div className="grid grid-cols-4 gap-1 mt-4 p-1 rounded-xl bg-black/40 border border-white/[0.07]">
              <button
                onClick={() => setActiveTab('appearance')}
                className={`tactile-btn flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11.5px] font-medium ${
                  activeTab === 'appearance'
                    ? 'bg-white/[0.12] text-white shadow-sm border border-white/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" /> Appearance
              </button>

              <button
                onClick={() => setActiveTab('persona')}
                className={`tactile-btn flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11.5px] font-medium ${
                  activeTab === 'persona'
                    ? 'bg-white/[0.12] text-white shadow-sm border border-white/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Brain className="w-3.5 h-3.5" /> AI Brain
              </button>

              <button
                onClick={() => setActiveTab('hardware')}
                className={`tactile-btn flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11.5px] font-medium ${
                  activeTab === 'hardware'
                    ? 'bg-white/[0.12] text-white shadow-sm border border-white/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" /> Voice &amp; Chip
              </button>

              <button
                onClick={() => setActiveTab('storage')}
                className={`tactile-btn flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11.5px] font-medium ${
                  activeTab === 'storage'
                    ? 'bg-white/[0.12] text-white shadow-sm border border-white/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Database className="w-3.5 h-3.5" /> Models
              </button>
            </div>

            {/* TAB 1: APPEARANCE (Streamlined & Cohesive) */}
            {activeTab === 'appearance' && (
              <div className="mt-4 space-y-3.5 max-h-[25rem] overflow-y-auto pr-1">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-semibold text-slate-200">
                      Robot &amp; Space Theme Presets
                    </span>
                    <button
                      onClick={() => onCustomizationChange(DEFAULT_CUSTOMIZATION)}
                      className="tactile-btn flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[10.5px] font-medium text-slate-300"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset Default
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {(Object.keys(HAIR_PALETTES) as HairPresetId[]).map((presetKey) => {
                      const preset = HAIR_PALETTES[presetKey];
                      const active = customization.hairPreset === presetKey;
                      return (
                        <button
                          key={presetKey}
                          onClick={() => applyChassisPreset(presetKey)}
                          className={`tactile-btn p-2 rounded-xl border text-left transition-all ${
                            active
                              ? 'border-sky-400/60 bg-sky-500/10'
                              : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'
                          }`}
                        >
                          <div
                            className={`w-full h-3.5 rounded-md bg-gradient-to-r ${preset.swatch} mb-1.5`}
                          />
                          <div className="text-[10.5px] font-medium text-slate-200 truncate">
                            {preset.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3 Essential Custom Colors */}
                <div className="grid grid-cols-3 gap-2.5">
                  <label className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between cursor-pointer hover:border-white/15">
                    <div>
                      <div className="text-[11px] font-medium text-slate-200">Robot Shell</div>
                      <div className="text-[10px] font-mono text-slate-500 uppercase">
                        {customization.hairPrimaryHex}
                      </div>
                    </div>
                    <input
                      type="color"
                      value={customization.hairPrimaryHex}
                      onChange={(e) => updateCustom({ hairPrimaryHex: e.target.value })}
                      className="w-6 h-6 rounded-md bg-transparent cursor-pointer border-0"
                    />
                  </label>

                  <label className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between cursor-pointer hover:border-white/15">
                    <div>
                      <div className="text-[11px] font-medium text-slate-200">Visor &amp; Core</div>
                      <div className="text-[10px] font-mono text-slate-500 uppercase">
                        {customization.eyeIrisHex}
                      </div>
                    </div>
                    <input
                      type="color"
                      value={customization.eyeIrisHex}
                      onChange={(e) =>
                        updateCustom({
                          eyeIrisHex: e.target.value,
                          cyberAccentHex: e.target.value,
                          auraRingHex: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded-md bg-transparent cursor-pointer border-0"
                    />
                  </label>

                  <label className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between cursor-pointer hover:border-white/15">
                    <div>
                      <div className="text-[11px] font-medium text-slate-200">Space Nebula</div>
                      <div className="text-[10px] font-mono text-slate-500 uppercase">
                        {customization.roomRimLightHex}
                      </div>
                    </div>
                    <input
                      type="color"
                      value={customization.roomRimLightHex}
                      onChange={(e) => updateCustom({ roomRimLightHex: e.target.value })}
                      className="w-6 h-6 rounded-md bg-transparent cursor-pointer border-0"
                    />
                  </label>
                </div>

                {/* 2 Essential Sliders */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-1.5">
                    <div className="flex justify-between text-[11px] tabular-nums">
                      <span className="text-slate-300 font-medium">Visor Glow Intensity</span>
                      <span className="font-mono text-slate-400">
                        {customization.eyeLuminescence.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={customization.eyeLuminescence}
                      onChange={(e) =>
                        updateCustom({ eyeLuminescence: parseFloat(e.target.value) })
                      }
                      className="w-full accent-sky-400 cursor-pointer"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-1.5">
                    <div className="flex justify-between text-[11px] tabular-nums">
                      <span className="text-slate-300 font-medium">Deep Space Brightness</span>
                      <span className="font-mono text-slate-400">
                        {Math.round(customization.roomAmbientIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.4"
                      max="1.8"
                      step="0.05"
                      value={customization.roomAmbientIntensity}
                      onChange={(e) =>
                        updateCustom({ roomAmbientIntensity: parseFloat(e.target.value) })
                      }
                      className="w-full accent-sky-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: AI BRAIN & SYSTEM INSTRUCTIONS (Editable & Live) */}
            {activeTab === 'persona' && (
              <div className="mt-4 space-y-3.5 max-h-[25rem] overflow-y-auto pr-1">
                {/* Quick Behavior Presets */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300">
                      AI Behavior &amp; Roleplay Presets
                    </span>
                    <span className="text-slate-400">Click to apply immediately</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PERSONA_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleApplyPersonaPreset(preset)}
                        className="tactile-btn p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-sky-400/40 text-left transition-all"
                      >
                        <div className="text-xs font-semibold text-white">{preset.label}</div>
                        <div className="text-[10.5px] text-slate-400 mt-0.5">
                          {preset.subtitle}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Creativity / Temperature Slider */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] tabular-nums">
                    <span className="font-medium text-slate-200">
                      AI Creativity &amp; Expressiveness (Temperature)
                    </span>
                    <span className="font-mono text-sky-300 font-semibold">
                      {temperature.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.2"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    onMouseUp={() => handleSavePersona(promptDraft, temperature, false)}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>0.20 Precise &amp; Analytical</span>
                    <span>0.70 Balanced</span>
                    <span>1.20 Highly Creative</span>
                  </div>
                </div>

                {/* Editable System Instructions (system_prompt.txt) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">
                      System Instructions (<code className="font-mono text-[11px] text-slate-400">system_prompt.txt</code>)
                    </span>
                    <button
                      onClick={() => handleSavePersona(promptDraft, temperature, false)}
                      disabled={isSavingPersona}
                      className={`tactile-btn flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        personaSaved
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/30'
                      }`}
                    >
                      {personaSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Saved &amp; Active
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />{' '}
                          {isSavingPersona ? 'Saving…' : 'Save Instructions'}
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={promptDraft}
                    onChange={(e) => setPromptDraft(e.target.value)}
                    rows={5}
                    placeholder="Enter custom instructions or persona rules for Lloyd..."
                    className="w-full p-3 rounded-xl bg-black/50 border border-white/[0.1] focus:border-sky-400/50 focus:outline-none text-[11.5px] leading-relaxed text-slate-200 font-mono resize-none"
                  />
                </div>
              </div>
            )}

            {/* TAB 3: VOICE, AUDIO & HARDWARE */}
            {activeTab === 'hardware' && (
              <div className="mt-4 space-y-3.5 max-h-[25rem] overflow-y-auto pr-1">
                {/* Voice Input Mode */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-sky-400" /> Microphone Input Mode
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {voiceMode === 'vad' ? 'Auto-Detect Speech' : 'Hold Spacebar'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onVoiceModeChange('vad')}
                      className={`tactile-btn py-2 px-3 rounded-xl text-xs font-medium ${
                        voiceMode === 'vad'
                          ? 'bg-white/[0.12] border border-white/20 text-white'
                          : 'bg-white/[0.03] border border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Hands-Free (Auto VAD)
                    </button>
                    <button
                      onClick={() => onVoiceModeChange('ptt')}
                      className={`tactile-btn py-2 px-3 rounded-xl text-xs font-medium ${
                        voiceMode === 'ptt'
                          ? 'bg-white/[0.12] border border-white/20 text-white'
                          : 'bg-white/[0.03] border border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Push-to-Talk (Spacebar)
                    </button>
                  </div>
                </div>

                {/* Voice Speech Audio Output Toggle */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {ttsMuted ? (
                      <VolumeX className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    )}
                    <div>
                      <div className="text-xs font-medium text-white">
                        Spoken Voice Output (Neural TTS)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {ttsMuted
                          ? 'Voice audio is muted (text subtitles only)'
                          : 'Lloyd speaks responses aloud with real-time lip sync'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onTtsMutedChange(!ttsMuted)}
                    className={`tactile-btn px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                      ttsMuted
                        ? 'bg-amber-500/15 border-amber-400/30 text-amber-300'
                        : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                    }`}
                  >
                    {ttsMuted ? 'Muted' : 'Voice On'}
                  </button>
                </div>

                {/* Apple Silicon Telemetry */}
                <div className="grid grid-cols-2 gap-2.5 tabular-nums">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-sky-400" /> Apple Silicon Compute
                    </div>
                    <div className="text-xs font-semibold text-white mt-1">
                      {hardware?.chip || 'Apple Silicon'} ({hardware?.arch || 'arm64'})
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {hardware?.gpu_layers_offloaded || 'All Layers (-1 Metal)'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-indigo-400" /> Unified Memory
                    </div>
                    <div className="text-xs font-semibold text-white mt-1">
                      App RSS: {hardware?.memory?.process_rss_mb ?? 0} MB
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      System: {hardware?.memory?.system_used_gb ?? 0} /{' '}
                      {hardware?.memory?.system_total_gb ?? 8} GB (
                      {hardware?.memory?.system_percent ?? 0}%)
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    LLM Speed: {hardware?.latency?.avg_tokens_per_sec ?? 0} tok/s ·{' '}
                    {hardware?.latency?.avg_llm_ms ?? 0} ms
                  </span>
                  <button
                    onClick={handleClearMemory}
                    className={`tactile-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${
                      memoryCleared
                        ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
                        : 'bg-white/[0.06] hover:bg-rose-500/20 border-white/10 text-slate-200'
                    }`}
                  >
                    {memoryCleared ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Memory Cleared
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" /> Clear Chat Memory
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: STORAGE & MODELS */}
            {activeTab === 'storage' && (
              <div className="mt-4 space-y-3.5 max-h-[25rem] overflow-y-auto pr-1">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-sky-400" />
                      Local AI Model &amp; Instructions Folder
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {health?.models?.app_support_dir ||
                        '~/Library/Application Support/Lloyd/models'}
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-200 tabular-nums">
                    <div>
                      {health?.models?.total_installed_mb ?? 0} /{' '}
                      {health?.models?.total_expected_mb ?? 1199.9} MB
                    </div>
                    <div className="text-[10px] text-emerald-400">
                      {health?.models?.ready ? 'Installed & Ready' : 'Setup Required'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* System Instructions File Row */}
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono text-[10px] font-semibold">
                        SYS
                      </span>
                      <span className="text-xs font-medium text-white">
                        system_prompt.txt
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        (System Instructions)
                      </span>
                    </div>
                    {health?.models?.system_prompt_seeded ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </div>

                  {(health?.models?.assets || []).map((asset) => (
                    <div
                      key={asset.id}
                      className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-white/10 text-slate-200 font-mono text-[10px] font-semibold">
                            {asset.category}
                          </span>
                          <span className="text-xs font-medium text-white">
                            {asset.filename}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                            ({asset.expected_mb} MB)
                          </span>
                        </div>
                      </div>
                      {asset.exists ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={handleVerifyWeights}
                    disabled={isVerifying}
                    className="tactile-btn py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                    <span>{isVerifying ? 'Verifying…' : 'Verify Files'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onOpenOnboarding();
                    }}
                    className="tactile-btn py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5"
                  >
                    <CloudDownload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Model Installer</span>
                  </button>

                  <button
                    onClick={handlePurgeWeights}
                    disabled={isPurging}
                    className="tactile-btn py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-400/30 text-xs font-medium text-rose-200 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isPurging ? 'Removing…' : 'Uninstall Models'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

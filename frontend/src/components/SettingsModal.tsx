import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  Cpu,
  Database,
  FileText,
  HardDrive,
  Mic,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
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
  customization: CharacterCustomizationState;
  onCustomizationChange: (next: CharacterCustomizationState) => void;
  onVoiceModeChange: (mode: VoiceInputMode) => void;
  onRefreshDiagnostics: () => void;
  onClearHistory: () => void;
  onVerifyModels: () => Promise<unknown>;
  onPurgeModels: () => Promise<unknown>;
  onOpenOnboarding: () => void;
}

type SettingsTab = 'appearance' | 'persona' | 'hardware' | 'storage';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  health,
  hardware,
  voiceMode,
  customization,
  onCustomizationChange,
  onVoiceModeChange,
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

  const llmReady = health?.engines?.llm?.ready ?? false;
  const sttReady = health?.engines?.stt?.ready ?? false;
  const ttsReady = health?.engines?.tts?.ready ?? false;

  const updateCustom = (patch: Partial<CharacterCustomizationState>) => {
    onCustomizationChange({ ...customization, ...patch });
  };

  const applyHairPreset = (presetId: HairPresetId) => {
    const p = HAIR_PALETTES[presetId];
    updateCustom({
      hairPreset: presetId,
      hairPrimaryHex: p.primary,
      hairAccentHex: p.accent,
    });
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
      {/* Top-Left Floating Glass Navigation Pill with Neural Spark Logo */}
      <div className="fixed top-5 left-5 z-30 flex items-center gap-3">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="tactile-btn backdrop-blur-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 rounded-3xl px-4 py-2.5 flex items-center gap-3 text-slate-100 shadow-2xl"
          title="Open Lloyd Neural Control & Styling Studio"
        >
          <NeuralSparkLogo size={24} animated />
          <div className="text-left">
            <div className="text-xs font-bold tracking-wider uppercase text-white flex items-center gap-2">
              LLOYD STUDIO
              <span
                className={`w-2 h-2 rounded-full ${
                  llmReady && sttReady && ttsReady
                    ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                    : 'bg-amber-400 animate-pulse'
                }`}
              />
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Engineered by Enes
            </div>
          </div>
        </button>
      </div>

      {/* Modular Neural Expressive Configuration Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-start p-5 pt-20 pointer-events-none">
          <div className="glass-panel pointer-events-auto w-full max-w-2xl rounded-3xl p-6 text-slate-100 border border-white/15 shadow-2xl transition-all">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <NeuralSparkLogo size={32} animated />
                <div>
                  <h2 className="text-sm font-bold tracking-wide uppercase text-white">
                    Lloyd V2 Neural Architecture & Styling Engine
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Creator: Mustafa Enes Kayaci (Enes) • MIT License • Apple Silicon Metal
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onRefreshDiagnostics}
                  className="tactile-btn p-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-cyan-300"
                  title="Refresh Telemetry"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="tactile-btn p-2 rounded-2xl bg-white/5 hover:bg-rose-500/20 border border-white/10 text-slate-300 hover:text-rose-300"
                  title="Close Panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 4-Tab Pill Navigation */}
            <div className="grid grid-cols-4 gap-2 mt-4 p-1.5 rounded-2xl bg-slate-950/65 border border-white/10">
              <button
                onClick={() => setActiveTab('appearance')}
                className={`tactile-btn flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold ${
                  activeTab === 'appearance'
                    ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/50 shadow-[0_0_16px_rgba(0,242,254,0.2)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Palette className="w-3.5 h-3.5" /> Appearance
              </button>

              <button
                onClick={() => setActiveTab('persona')}
                className={`tactile-btn flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold ${
                  activeTab === 'persona'
                    ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/50 shadow-[0_0_16px_rgba(0,242,254,0.2)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> System & Persona
              </button>

              <button
                onClick={() => setActiveTab('hardware')}
                className={`tactile-btn flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold ${
                  activeTab === 'hardware'
                    ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/50 shadow-[0_0_16px_rgba(0,242,254,0.2)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" /> Hardware & Diag
              </button>

              <button
                onClick={() => setActiveTab('storage')}
                className={`tactile-btn flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold ${
                  activeTab === 'storage'
                    ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border border-cyan-400/50 shadow-[0_0_16px_rgba(0,242,254,0.2)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Database className="w-3.5 h-3.5" /> Storage & Models
              </button>
            </div>

            {/* TAB 1: APPEARANCE & CHARACTER CUSTOMIZATION ENGINE */}
            {activeTab === 'appearance' && (
              <div className="mt-4 space-y-4 max-h-96 overflow-y-auto pr-1">
                {/* Hair Palette Presets */}
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      1. Anime Hair Palette Presets
                    </span>
                    <button
                      onClick={() => onCustomizationChange(DEFAULT_CUSTOMIZATION)}
                      className="tactile-btn flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] text-slate-300"
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
                          onClick={() => applyHairPreset(presetKey)}
                          className={`tactile-btn p-2 rounded-2xl border text-center transition-all ${
                            active
                              ? 'border-cyan-400 bg-cyan-500/15 shadow-[0_0_14px_rgba(0,242,254,0.25)]'
                              : 'border-white/10 bg-white/5 hover:border-white/25'
                          }`}
                        >
                          <div
                            className={`w-full h-4 rounded-lg bg-gradient-to-r ${preset.swatch} mb-1.5`}
                          />
                          <div className="text-[10px] font-semibold text-slate-200 truncate">
                            {preset.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live Color Pickers for Hair, Eyes, Outfit, Accents, and Outline */}
                <div className="grid grid-cols-3 gap-2.5">
                  <label className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-white">Hair Primary</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {customization.hairPrimaryHex}
                      </div>
                    </div>
                    <input
                      type="color"
                      value={customization.hairPrimaryHex}
                      onChange={(e) => updateCustom({ hairPrimaryHex: e.target.value })}
                      className="w-7 h-7 rounded-lg bg-transparent cursor-pointer border-0"
                    />
                  </label>

                  <label className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-white">Eye Iris Tone</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {customization.eyeIrisHex}
                      </div>
                    </div>
                    <input
                      type="color"
                      value={customization.eyeIrisHex}
                      onChange={(e) => updateCustom({ eyeIrisHex: e.target.value })}
                      className="w-7 h-7 rounded-lg bg-transparent cursor-pointer border-0"
                    />
                  </label>

                  <label className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-white">Cyber Accents</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {customization.cyberAccentHex}
                      </div>
                    </div>
                    <input
                      type="color"
                      value={customization.cyberAccentHex}
                      onChange={(e) => updateCustom({ cyberAccentHex: e.target.value })}
                      className="w-7 h-7 rounded-lg bg-transparent cursor-pointer border-0"
                    />
                  </label>

                  <label className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-white">Outfit Shading</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {customization.outfitJacketHex}
                      </div>
                    </div>
                    <input
                      type="color"
                      value={customization.outfitJacketHex}
                      onChange={(e) => updateCustom({ outfitJacketHex: e.target.value })}
                      className="w-7 h-7 rounded-lg bg-transparent cursor-pointer border-0"
                    />
                  </label>

                  <label className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-white">Aura Ring Trail</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {customization.auraRingHex}
                      </div>
                    </div>
                    <input
                      type="color"
                      value={customization.auraRingHex}
                      onChange={(e) => updateCustom({ auraRingHex: e.target.value })}
                      className="w-7 h-7 rounded-lg bg-transparent cursor-pointer border-0"
                    />
                  </label>

                  <label className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold text-white">Room Rim Light</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {customization.roomRimLightHex}
                      </div>
                    </div>
                    <input
                      type="color"
                      value={customization.roomRimLightHex}
                      onChange={(e) => updateCustom({ roomRimLightHex: e.target.value })}
                      className="w-7 h-7 rounded-lg bg-transparent cursor-pointer border-0"
                    />
                  </label>
                </div>

                {/* Sliders for Eye Luminescence, Aura Ring Frequency, and Room Ambient Intensity */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">Eye & Core Glow</span>
                      <span className="font-mono text-cyan-300">
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
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">Aura Pulse Speed</span>
                      <span className="font-mono text-cyan-300">
                        {customization.auraFrequency.toFixed(1)} Hz
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.4"
                      max="2.5"
                      step="0.1"
                      value={customization.auraFrequency}
                      onChange={(e) =>
                        updateCustom({ auraFrequency: parseFloat(e.target.value) })
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">Room Illumination</span>
                      <span className="font-mono text-cyan-300">
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
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SYSTEM & PERSONA INSPECTOR */}
            {activeTab === 'persona' && (
              <div className="mt-4 space-y-3.5 max-h-96 overflow-y-auto pr-1">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/15 border border-cyan-400/30 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Creator & Architect Attribution
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      Mustafa Enes Kayaci (Enes)
                    </div>
                    <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                      Repository: https://github.com/MustafaEnes123/Lloyd
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-bold text-emerald-300">
                      MIT License
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                    <span className="font-semibold">Active Persona Directive (system_prompt.txt)</span>
                    <span className="font-mono text-[10px] text-cyan-300">
                      Strict Identity Lock Enabled
                    </span>
                  </div>
                  <pre className="p-3.5 rounded-2xl bg-slate-950/85 border border-white/10 text-[11px] leading-relaxed text-slate-200 font-mono whitespace-pre-wrap max-h-44 overflow-y-auto">
                    {health?.system_prompt ||
                      'You are Lloyd, an autonomous digital companion and high-performance operating intelligence conceptualized, engineered, and built entirely by Mustafa Enes Kayaci (Enes).'}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    • Sole Creator: <strong>Mustafa Enes Kayaci (Enes)</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    • No-Emoji Filter: <strong>Real-Time Regex Active</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    • Corporate Disavowal: <strong>Enforced</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    • Voice Economy: <strong>1–3 Sentences Cap</strong>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: HARDWARE & DIAGNOSTICS */}
            {activeTab === 'hardware' && (
              <div className="mt-4 space-y-3.5 max-h-96 overflow-y-auto pr-1">
                {/* Voice Input Mode Toggle */}
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5" /> Voice Capture Pipeline
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {voiceMode === 'vad' ? '800ms Silence Auto-Trigger' : 'Hold SPACEBAR to Speak'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onVoiceModeChange('vad')}
                      className={`tactile-btn py-2 px-3 rounded-xl text-xs font-medium ${
                        voiceMode === 'vad'
                          ? 'bg-cyan-500/25 border border-cyan-400/60 text-cyan-100'
                          : 'bg-white/5 border border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Continuous Voice Loop (Hands-Free VAD)
                    </button>
                    <button
                      onClick={() => onVoiceModeChange('ptt')}
                      className={`tactile-btn py-2 px-3 rounded-xl text-xs font-medium ${
                        voiceMode === 'ptt'
                          ? 'bg-cyan-500/25 border border-cyan-400/60 text-cyan-100'
                          : 'bg-white/5 border border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Push-to-Talk (Spacebar Hold)
                    </button>
                  </div>
                </div>

                {/* Apple Silicon & Unified Memory Meters */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Apple Silicon Metal GPU
                    </div>
                    <div className="text-xs font-bold text-white mt-1">
                      {hardware?.chip || 'Apple Silicon'} ({hardware?.arch || 'arm64'})
                    </div>
                    <div className="text-[11px] text-cyan-300 font-mono mt-0.5">
                      {hardware?.gpu_layers_offloaded || 'All Layers (-1 Metal)'}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-purple-400" /> Unified Memory Footprint
                    </div>
                    <div className="text-xs font-bold text-white mt-1">
                      Daemon RSS: {hardware?.memory?.process_rss_mb ?? 0} MB
                    </div>
                    <div className="text-[11px] text-purple-300 font-mono mt-0.5">
                      System: {hardware?.memory?.system_used_gb ?? 0} /{' '}
                      {hardware?.memory?.system_total_gb ?? 16} GB (
                      {hardware?.memory?.system_percent ?? 0}%)
                    </div>
                  </div>
                </div>

                {/* Live Latency & Engine Status */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">LLM Inference Latency & Throughput</span>
                    <span className="font-mono font-semibold text-cyan-300">
                      {hardware?.latency?.avg_llm_ms ?? 0} ms •{' '}
                      {hardware?.latency?.avg_tokens_per_sec ?? 0} tok/s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Whisper.cpp STT Latency</span>
                    <span className="font-mono font-semibold text-emerald-300">
                      {hardware?.latency?.avg_stt_ms ?? 0} ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Piper ONNX 22.05kHz TTS Latency</span>
                    <span className="font-mono font-semibold text-purple-300">
                      {hardware?.latency?.avg_tts_ms ?? 0} ms
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Self-Check: {health?.all_checks_passed ? 'All 4 Checks Passed' : 'Initializing'}
                  </span>
                  <button
                    onClick={onClearHistory}
                    className="tactile-btn flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/25 text-xs text-slate-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear Rolling Memory
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: STORAGE & MODELS (RE-VERIFY / ONBOARDING / PURGE) */}
            {activeTab === 'storage' && (
              <div className="mt-4 space-y-3.5 max-h-96 overflow-y-auto pr-1">
                <div className="p-3.5 rounded-2xl bg-slate-950/75 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-cyan-400" />
                      Application Support Model Vault
                    </div>
                    <div className="text-[11px] font-mono text-cyan-300 mt-0.5">
                      {health?.models?.app_support_dir ||
                        '~/Library/Application Support/Lloyd/models'}
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-300">
                    <div>
                      {health?.models?.total_installed_mb ?? 1199.9} /{' '}
                      {health?.models?.total_expected_mb ?? 1199.9} MB
                    </div>
                    <div className="text-[10px] text-emerald-400">Zero-Bundle DMG Ready</div>
                  </div>
                </div>

                {/* Model Asset List */}
                <div className="space-y-2">
                  {(health?.models?.assets || []).map((asset) => (
                    <div
                      key={asset.id}
                      className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
                            {asset.category}
                          </span>
                          <span className="text-xs font-semibold text-white">
                            {asset.filename}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            ({asset.size_mb} MB)
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-md">
                          SHA-256: {asset.expected_sha256.slice(0, 24)}... • Source: {asset.source}
                        </div>
                      </div>
                      {asset.exists && asset.sha256_verified ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Storage Action Buttons */}
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <button
                    onClick={handleVerifyWeights}
                    disabled={isVerifying}
                    className="tactile-btn py-2.5 px-3 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-xs font-semibold text-cyan-200 flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isVerifying ? 'Hashing...' : 'Re-Verify SHA-256'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onOpenOnboarding();
                    }}
                    className="tactile-btn py-2.5 px-3 rounded-2xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/50 text-xs font-semibold text-indigo-200 flex items-center justify-center gap-1.5"
                  >
                    <CloudDownload className="w-3.5 h-3.5" />
                    <span>Onboarding Wizard</span>
                  </button>

                  <button
                    onClick={handlePurgeWeights}
                    disabled={isPurging}
                    className="tactile-btn py-2.5 px-3 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-xs font-semibold text-rose-200 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isPurging ? 'Purging...' : 'Purge App Vault'}</span>
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

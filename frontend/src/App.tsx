import React, { useEffect, useState } from 'react';
import { Canvas3D } from './components/Canvas3D';
import { DiagnosticBar } from './components/DiagnosticBar';
import { OnboardingModal } from './components/OnboardingModal';
import { SettingsModal } from './components/SettingsModal';
import { SubtitleOverlay } from './components/SubtitleOverlay';
import { useLloydSocket, type VoiceInputMode } from './hooks/useLloydSocket';
import { useVoiceLoop } from './hooks/useVoiceLoop';
import {
  loadCustomizationState,
  saveCustomizationState,
  type CharacterCustomizationState,
} from './types/customization';

export const App: React.FC = () => {
  const [voiceMode, setVoiceMode] = useState<VoiceInputMode>('vad');
  const [customization, setCustomization] = useState<CharacterCustomizationState>(() =>
    loadCustomizationState()
  );
  const [manualOnboardingOpen, setManualOnboardingOpen] = useState<boolean>(false);

  const {
    connected,
    companionState,
    health,
    hardware,
    liveSubtitle,
    lastUserTranscript,
    audioMetrics,
    sendText,
    sendAudioChunk,
    startPushToTalk,
    releasePushToTalk,
    interrupt,
    clearHistory,
    refreshDiagnostics,
    verifyModels,
    purgeModels,
  } = useLloydSocket();

  const {
    micEnabled,
    micLevel,
    isPttHeld,
    toggleMicrophone,
    beginPushToTalk,
    endPushToTalk,
  } = useVoiceLoop({
    mode: voiceMode,
    onAudioChunk: sendAudioChunk,
    onPttStart: startPushToTalk,
    onPttRelease: releasePushToTalk,
  });

  useEffect(() => {
    saveCustomizationState(customization);
  }, [customization]);

  const isOnboardingOpen =
    manualOnboardingOpen || Boolean(health?.needs_onboarding);

  const handleOnboardingComplete = () => {
    setManualOnboardingOpen(false);
    refreshDiagnostics();
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#050814] select-none">
      {/* 3D Anime Companion & Cyber-Loft Simulation Scene */}
      <Canvas3D
        companionState={companionState}
        audioMetrics={audioMetrics}
        micLevel={micLevel}
        customization={customization}
        isOnboarding={isOnboardingOpen}
      />

      {/* Top-Left Floating Glass Navigation, Styling Studio & 4-Tab Settings Modal */}
      <SettingsModal
        health={health}
        hardware={hardware}
        voiceMode={voiceMode}
        customization={customization}
        onCustomizationChange={setCustomization}
        onVoiceModeChange={setVoiceMode}
        onRefreshDiagnostics={refreshDiagnostics}
        onClearHistory={clearHistory}
        onVerifyModels={verifyModels}
        onPurgeModels={purgeModels}
        onOpenOnboarding={() => setManualOnboardingOpen(true)}
      />

      {/* Top-Right Live Hardware, STT, LLM, TTS Status Bar */}
      <DiagnosticBar
        connected={connected}
        companionState={companionState}
        health={health}
        hardware={hardware}
        micEnabled={micEnabled}
        voiceMode={voiceMode}
        onToggleMic={toggleMicrophone}
        onInterrupt={interrupt}
      />

      {/* Bottom-Center Floating Neural Expressive Subtitle & Dialogue Dock */}
      <SubtitleOverlay
        liveSubtitle={liveSubtitle}
        lastUserTranscript={lastUserTranscript}
        companionState={companionState}
        audioMetrics={audioMetrics}
        micLevel={micLevel}
        voiceMode={voiceMode}
        isPttHeld={isPttHeld}
        onSendText={sendText}
        onPttDown={beginPushToTalk}
        onPttUp={endPushToTalk}
      />

      {/* Automated Onboarding & Asset Download Wizard */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onComplete={handleOnboardingComplete}
      />
    </main>
  );
};

export default App;

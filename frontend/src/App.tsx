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
  type RobotEmotion,
} from './types/customization';

export const App: React.FC = () => {
  const [voiceMode, setVoiceMode] = useState<VoiceInputMode>('vad');
  const [customization, setCustomization] = useState<CharacterCustomizationState>(() =>
    loadCustomizationState()
  );
  const [manualOnboardingOpen, setManualOnboardingOpen] = useState<boolean>(false);
  const [activeEmotion, setActiveEmotion] = useState<RobotEmotion>('happy');
  const [cameraPreset, setCameraPreset] = useState<'default' | 'closeup' | 'wide'>('default');

  const {
    connected,
    companionState,
    health,
    hardware,
    liveSubtitle,
    lastUserTranscript,
    audioMetrics,
    ttsMuted,
    setTtsMuted,
    sendText,
    sendAudioChunk,
    startPushToTalk,
    releasePushToTalk,
    interrupt,
    clearHistory,
    refreshDiagnostics,
    verifyModels,
    purgeModels,
    updatePersona,
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

  const handleRobotInteract = () => {
    const cycle: RobotEmotion[] = ['excited', 'happy', 'wink', 'curious', 'zen'];
    setActiveEmotion((prev) => cycle[(cycle.indexOf(prev) + 1) % cycle.length]);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#03050a] select-none">
      {/* 3D Deep Space Orbital Observatory & Centered Expressive Robot Companion */}
      <Canvas3D
        companionState={companionState}
        audioMetrics={audioMetrics}
        micLevel={micLevel}
        customization={customization}
        isOnboarding={isOnboardingOpen}
        activeEmotion={activeEmotion}
        cameraPreset={cameraPreset}
        onRobotInteract={handleRobotInteract}
      />

      {/* Top-Left Brand Trigger & 4-Tab Robotics Studio Inspector */}
      <SettingsModal
        health={health}
        hardware={hardware}
        voiceMode={voiceMode}
        ttsMuted={ttsMuted}
        customization={customization}
        onCustomizationChange={setCustomization}
        onVoiceModeChange={setVoiceMode}
        onTtsMutedChange={setTtsMuted}
        onUpdatePersona={updatePersona}
        onRefreshDiagnostics={refreshDiagnostics}
        onClearHistory={clearHistory}
        onVerifyModels={verifyModels}
        onPurgeModels={purgeModels}
        onOpenOnboarding={() => setManualOnboardingOpen(true)}
      />

      {/* Top-Right Interactive Mood Switcher, Camera Framing & Live Telemetry */}
      <DiagnosticBar
        connected={connected}
        companionState={companionState}
        health={health}
        hardware={hardware}
        micEnabled={micEnabled}
        voiceMode={voiceMode}
        activeEmotion={activeEmotion}
        cameraPreset={cameraPreset}
        onEmotionSelect={setActiveEmotion}
        onCameraPresetChange={setCameraPreset}
        onToggleMic={toggleMicrophone}
        onInterrupt={interrupt}
      />

      {/* Bottom-Center Editorial Dialogue & Command Dock */}
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

      {/* Automated Onboarding & SHA-256 Asset Verification Wizard */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onComplete={handleOnboardingComplete}
      />
    </main>
  );
};

export default App;

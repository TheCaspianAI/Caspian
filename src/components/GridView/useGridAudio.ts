import { useEffect, useRef, useCallback } from 'react';

// SFX-only audio hook (no background music)
export function useGridAudio(enabled: boolean = true) {
  const swipeAudioRef = useRef<HTMLAudioElement | null>(null);
  const selectAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio elements
  useEffect(() => {
    if (!enabled) return;

    // Preload swipe sound
    const swipeAudio = new Audio('/audio/swipe.mp3');
    swipeAudio.volume = 0.15;
    swipeAudio.preload = 'auto';
    swipeAudioRef.current = swipeAudio;

    // Create select sound
    const selectAudio = new Audio('/audio/swipe.mp3');
    selectAudio.volume = 0.25;
    selectAudio.playbackRate = 1.3;
    selectAudio.preload = 'auto';
    selectAudioRef.current = selectAudio;

    return () => {
      swipeAudioRef.current = null;
      selectAudioRef.current = null;
    };
  }, [enabled]);

  // Play navigation sound using the swipe mp3
  const playNavigateSound = useCallback(() => {
    const audio = swipeAudioRef.current;
    if (!audio) return;

    try {
      // Clone and play to allow overlapping sounds
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = 0.12;
      clone.playbackRate = 1.1;
      clone.play().catch(() => {});
    } catch (e) {}
  }, []);

  // Play select sound
  const playSelectSound = useCallback(() => {
    const audio = selectAudioRef.current;
    if (!audio) return;

    try {
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = 0.2;
      clone.playbackRate = 1.4;
      clone.play().catch(() => {});
    } catch (e) {}
  }, []);

  // Play hover sound (very subtle)
  const playHoverSound = useCallback(() => {
    const audio = swipeAudioRef.current;
    if (!audio) return;

    try {
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = 0.05;
      clone.playbackRate = 1.8;
      clone.play().catch(() => {});
    } catch (e) {}
  }, []);

  return {
    playNavigateSound,
    playSelectSound,
    playHoverSound,
  };
}

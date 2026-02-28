/**
 * useAlertSiren - Audible alarm siren using Web Audio API
 * Plays when posture alert or crowd violation triggers
 */

import { useRef, useCallback } from 'react';

export function useAlertSiren() {
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainRef = useRef(null);
  const intervalRef = useRef(null);

  const stopSiren = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch (e) {}
      oscillatorRef.current = null;
    }
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
  }, []);

  const playSiren = useCallback((durationMs = 5000) => {
    stopSiren();
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.3;
      gainNode.connect(ctx.destination);
      oscillator.connect(gainNode);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.start(ctx.currentTime);
      oscillatorRef.current = oscillator;
      gainRef.current = gainNode;

      let step = 0;
      intervalRef.current = setInterval(() => {
        step++;
        if (oscillatorRef.current && oscillatorRef.current.frequency) {
          const freq = step % 2 === 0 ? 880 : 660;
          oscillatorRef.current.frequency.setValueAtTime(freq, ctx.currentTime);
        }
      }, 200);

      setTimeout(() => {
        stopSiren();
      }, durationMs);
    } catch (e) {
      console.warn('Alert siren not available:', e);
    }
  }, [stopSiren]);

  /** Play siren continuously until stopSiren() is called */
  const playSirenContinuous = useCallback(() => {
    stopSiren();
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.3;
      gainNode.connect(ctx.destination);
      oscillator.connect(gainNode);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.start(ctx.currentTime);
      oscillatorRef.current = oscillator;
      gainRef.current = gainNode;

      let step = 0;
      intervalRef.current = setInterval(() => {
        step++;
        if (oscillatorRef.current && oscillatorRef.current.frequency) {
          const freq = step % 2 === 0 ? 880 : 660;
          oscillatorRef.current.frequency.setValueAtTime(freq, ctx.currentTime);
        }
      }, 200);
    } catch (e) {
      console.warn('Alert siren not available:', e);
    }
  }, [stopSiren]);

  return { playSiren, playSirenContinuous, stopSiren };
}

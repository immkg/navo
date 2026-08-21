import { useCallback, useRef, useState } from "react";

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Thin wrapper around the browser's SpeechRecognition API for one-shot
// dictation (e.g. filling in a text field by voice). Not supported in every
// browser (notably Safari/Firefox) — check `isSupported` before showing any
// mic UI, and treat it as a progressive enhancement, never the only way in.
export function useVoiceDictation({ onResult, onError } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef(null);
  const isSupported = Boolean(getSpeechRecognitionCtor());

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor || isListening) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // Speech has stopped but the transcript hasn't come back yet — surface
    // that gap as "transcribing" rather than leaving the mic looking stuck.
    recognition.onspeechend = () => {
      setIsProcessing(true);
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) onResult?.(transcript);
    };
    recognition.onerror = (event) => {
      onError?.(event.error);
    };
    recognition.onend = () => {
      setIsListening(false);
      setIsProcessing(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    setIsProcessing(false);
    recognition.start();
  }, [isListening, onResult, onError]);

  return { isSupported, isListening, isProcessing, start, stop };
}

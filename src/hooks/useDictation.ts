import { useCallback, useEffect, useRef, useState } from 'react';

// CAM-32: dictado con el reconocimiento de voz del navegador (Web Speech API). El audio no pasa
// por nuestro backend: lo transcribe el propio navegador (servidores de Google o Apple).

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionCtor = new () => RecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'No hay permiso para usar el micrófono. Habilitalo en el navegador para poder dictar.',
  'service-not-allowed': 'El dictado no está disponible en este navegador. Podés escribir el texto.',
  'audio-capture': 'No se encontró un micrófono en este dispositivo.',
  network: 'No se pudo transcribir: revisá la conexión e intentá de nuevo.',
  'language-not-supported': 'El dictado en español no está disponible en este navegador.',
};

const MAX_LISTENING_MS = 2 * 60 * 1000;
const MAX_SILENT_SESSIONS = 2;

// Solo un dictado a la vez en toda la pantalla: empezar uno corta el anterior.
let stopActiveDictation: (() => void) | null = null;

interface UseDictationResult {
  supported: boolean;
  listening: boolean;
  /** Lo que el navegador va entendiendo y todavía no confirmó. */
  interim: string;
  error: string | null;
  toggle: () => void;
  stop: () => void;
}

/** `onText` recibe cada frase ya confirmada, para agregarla al campo. */
export function useDictation(onText: (text: string) => void): UseDictationResult {
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const silentSessionsRef = useRef(0);
  const timeoutRef = useRef<number | undefined>(undefined);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    window.clearTimeout(timeoutRef.current);
    recognitionRef.current?.stop();
    setListening(false);
    setInterim('');
    if (stopActiveDictation === stopRef.current) stopActiveDictation = null;
  }, []);
  const stopRef = useRef(stop);
  const startSessionRef = useRef<() => void>(() => {});

  const startSession = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = 'es-AR';
    // En Android el modo continuo repite frases ya dichas: se usan sesiones cortas encadenadas.
    recognition.continuous = !/Android/i.test(navigator.userAgent);
    recognition.interimResults = true;

    let heardSomething = false;
    recognition.onresult = (event) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;
        heardSomething = true;
        if (result.isFinal) onTextRef.current(transcript);
        else pending += `${transcript} `;
      }
      setInterim(pending.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      wantListeningRef.current = false;
      setError(ERROR_MESSAGES[event.error] ?? 'No se pudo usar el dictado. Podés escribir el texto.');
    };
    recognition.onend = () => {
      setInterim('');
      silentSessionsRef.current = heardSomething ? 0 : silentSessionsRef.current + 1;
      // El navegador corta solo tras un silencio: se sigue escuchando hasta que el usuario termine.
      if (wantListeningRef.current && silentSessionsRef.current < MAX_SILENT_SESSIONS) {
        startSessionRef.current();
        return;
      }
      stopRef.current();
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      stopRef.current();
    }
  }, []);

  useEffect(() => {
    startSessionRef.current = startSession;
  }, [startSession]);

  const toggle = useCallback(() => {
    if (wantListeningRef.current) {
      stop();
      return;
    }
    stopActiveDictation?.();
    stopActiveDictation = stopRef.current;
    setError(null);
    silentSessionsRef.current = 0;
    wantListeningRef.current = true;
    setListening(true);
    timeoutRef.current = window.setTimeout(() => stopRef.current(), MAX_LISTENING_MS);
    startSession();
  }, [startSession, stop]);

  useEffect(
    () => () => {
      wantListeningRef.current = false;
      window.clearTimeout(timeoutRef.current);
      recognitionRef.current?.abort();
      if (stopActiveDictation === stopRef.current) stopActiveDictation = null;
    },
    [],
  );

  return { supported, listening, interim, error, toggle, stop };
}

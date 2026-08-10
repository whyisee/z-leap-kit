import { useCallback, useEffect, useRef, useState } from "react";

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0?: { transcript: string; confidence: number };
  }>;
};

type BrowserSpeechRecognitionErrorEvent = { error: string; message?: string };

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

type RecordingPhase = "idle" | "recording" | "recorded";

function chooseRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

function appendSpeech(prefix: string, speech: string): string {
  const left = prefix.trim();
  const right = speech.trim();
  if (!left) return right;
  if (!right) return left;
  return `${left}${/[，。！？；：,.!?;:]$/.test(left) ? "" : "，"}${right}`;
}

function fallbackAudioType(filename: string): string {
  const extension = filename.toLowerCase().split(".").pop();
  return (
    {
      webm: "audio/webm",
      ogg: "audio/ogg",
      m4a: "audio/mp4",
      mp4: "audio/mp4",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      aac: "audio/aac",
      flac: "audio/flac",
    }[extension ?? ""] ?? "application/octet-stream"
  );
}

export function useVoiceRecorder() {
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFilename, setAudioFilename] = useState("recording.webm");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transcribedByBrowser, setTranscribedByBrowser] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const audioUrlRef = useRef<string | null>(null);

  const speechSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
  const recordingSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined";

  const replaceAudioUrl = useCallback((blob: Blob | null) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const nextUrl = blob ? URL.createObjectURL(blob) : null;
    audioUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const start = useCallback(
    async (onTranscript: (text: string) => void, existingText = "") => {
      if (!recordingSupported || phase === "recording") {
        setError("当前浏览器不支持直接录音，可以选择已有录音文件");
        return;
      }

      setError(null);
      replaceAudioUrl(null);
      setAudioBlob(null);
      setDurationMs(0);
      setTranscribedByBrowser(false);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;
        const mimeType = chooseRecordingMimeType();
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        recorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onerror = () => setError("录音失败，请重新尝试");
        recorder.onstop = () => {
          const resolvedMimeType = recorder.mimeType || mimeType || "audio/webm";
          const blob = new Blob(chunks, { type: resolvedMimeType });
          const extension = resolvedMimeType.includes("mp4")
            ? "m4a"
            : resolvedMimeType.includes("ogg")
              ? "ogg"
              : "webm";
          setAudioFilename(`voice-${new Date().toISOString().replaceAll(":", "-")}.${extension}`);
          setAudioBlob(blob);
          replaceAudioUrl(blob);
          setDurationMs(Date.now() - startedAtRef.current);
          setPhase("recorded");
          stopTimer();
          stopTracks();
          recorderRef.current = null;
        };

        recorder.start(500);
        startedAtRef.current = Date.now();
        setPhase("recording");
        timerRef.current = window.setInterval(
          () => setDurationMs(Date.now() - startedAtRef.current),
          250,
        );

        const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
        if (!Recognition) {
          setError("当前浏览器不能自动转写；录音完成后请在文本框中手动补写内容");
          return;
        }

        const recognition = new Recognition();
        setTranscribedByBrowser(true);
        recognitionRef.current = recognition;
        recognition.lang = "zh-CN";
        recognition.continuous = true;
        recognition.interimResults = true;
        let committedSpeech = "";

        recognition.onresult = (event) => {
          let interimSpeech = "";
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const fragment = result[0]?.transcript ?? "";
            if (result.isFinal) committedSpeech += fragment;
            else interimSpeech += fragment;
          }
          onTranscript(appendSpeech(existingText, `${committedSpeech}${interimSpeech}`));
        };
        recognition.onerror = (event) => {
          if (event.error === "aborted" || event.error === "no-speech") return;
          setError("语音转写暂时不可用；录音会继续，你可以稍后手动修改文字");
        };
        recognition.onend = () => {
          if (recorderRef.current?.state === "recording") {
            try {
              recognition.start();
            } catch {
              // Some engines do not allow immediate restart; the audio recording remains valid.
            }
          }
        };
        try {
          recognition.start();
        } catch {
          recognitionRef.current = null;
          setTranscribedByBrowser(false);
          setError("语音转写没有启动；录音会继续，请在结束后手动填写文字");
        }
      } catch (recordingError) {
        stopTimer();
        stopTracks();
        setPhase("idle");
        setError(
          recordingError instanceof DOMException && recordingError.name === "NotAllowedError"
            ? "没有获得麦克风权限，请在浏览器设置中允许后重试"
            : "无法启动麦克风，请检查设备或浏览器权限",
        );
      }
    },
    [phase, recordingSupported, replaceAudioUrl, stopTimer, stopTracks],
  );

  const stop = useCallback(() => {
    if (phase !== "recording") return;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, [phase]);

  const selectFile = useCallback(
    (file: File) => {
      const mimeType = file.type || fallbackAudioType(file.name);
      const blob = file.type ? file : file.slice(0, file.size, mimeType);
      setAudioBlob(blob);
      setAudioFilename(file.name || "voice-recording");
      setDurationMs(0);
      setTranscribedByBrowser(false);
      setPhase("recorded");
      setError(
        speechSupported
          ? "已选择录音文件；浏览器不会自动转写已有文件，请在文本框中补写或粘贴内容"
          : "已选择录音文件；请在文本框中补写内容",
      );
      replaceAudioUrl(blob);
    },
    [replaceAudioUrl, speechSupported],
  );

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    stopTimer();
    stopTracks();
    setPhase("idle");
    setAudioBlob(null);
    setAudioFilename("recording.webm");
    setDurationMs(0);
    setTranscribedByBrowser(false);
    setError(null);
    replaceAudioUrl(null);
  }, [replaceAudioUrl, stopTimer, stopTracks]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopTimer();
      stopTracks();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [stopTimer, stopTracks],
  );

  return {
    phase,
    audioBlob,
    audioFilename,
    audioUrl,
    durationMs,
    error,
    recordingSupported,
    speechSupported,
    transcribedByBrowser,
    start,
    stop,
    selectFile,
    reset,
  };
}

import React, { useEffect, useRef, useState } from "react";

import Avatar from "./components/Avatar";
import VoiceButton from "./components/VoiceButton";
import Chat from "./components/Chat";
import Status from "./components/Status";
import { connectLive } from "./services/geminiLive";

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(
      i,
      Math.min(i + chunkSize, bytes.length)
    );

    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < float32Array.length; i++) {
    let sample = float32Array[i];

    sample = Math.max(-1, Math.min(1, sample));

    const value =
      sample < 0
        ? sample * 0x8000
        : sample * 0x7fff;

    view.setInt16(i * 2, value, true);
  }

  return buffer;
}

function resampleTo16k(input, inputSampleRate) {
  const outputSampleRate = 16000;

  if (inputSampleRate === outputSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = position - left;

    output[i] =
      input[left] * (1 - fraction) +
      input[right] * fraction;
  }

  return output;
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

function pcm16ToFloat32(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const samples = new Float32Array(arrayBuffer.byteLength / 2);

  for (let i = 0; i < samples.length; i++) {
    samples[i] = view.getInt16(i * 2, true) / 32768;
  }

  return samples;
}

function App() {
  const [status, setStatus] = useState("idle");
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");

  const sessionRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);

  const outputAudioContextRef = useRef(null);
  const nextAudioTimeRef = useRef(0);
  const audioSourcesRef = useRef([]);
  const isRunningRef = useRef(false);

  const addMessage = (sender, text) => {
    if (!text?.trim()) return;

    setMessages((previous) => [
      ...previous,
      {
        id: Date.now() + Math.random(),
        sender,
        text: text.trim(),
      },
    ]);
  };

  const stopOutputAudio = () => {
    audioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        //
      }
    });

    audioSourcesRef.current = [];
    nextAudioTimeRef.current = 0;
  };

  const playGeminiAudio = async (base64Audio) => {
    if (!base64Audio) return;

    try {
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new AudioContext({
          sampleRate: 24000,
        });
      }

      const audioContext = outputAudioContextRef.current;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const arrayBuffer = base64ToArrayBuffer(base64Audio);
      const float32Audio = pcm16ToFloat32(arrayBuffer);

      if (!float32Audio.length) return;

      const audioBuffer = audioContext.createBuffer(
        1,
        float32Audio.length,
        24000
      );

      audioBuffer.copyToChannel(float32Audio, 0);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      const currentTime = audioContext.currentTime;

      if (nextAudioTimeRef.current < currentTime) {
        nextAudioTimeRef.current = currentTime;
      }

      const startTime = nextAudioTimeRef.current;

      source.start(startTime);

      nextAudioTimeRef.current =
        startTime + audioBuffer.duration;

      audioSourcesRef.current.push(source);

      source.onended = () => {
        audioSourcesRef.current =
          audioSourcesRef.current.filter(
            (item) => item !== source
          );

        if (
          audioSourcesRef.current.length === 0 &&
          isRunningRef.current
        ) {
          setStatus("listening");
        }
      };
    } catch (audioError) {
      console.error("Audio playback error:", audioError);
    }
  };

  const handleGeminiMessage = (message) => {
    const serverContent = message?.serverContent;

    if (!serverContent) return;

    const inputTranscription =
      serverContent.inputTranscription;

    if (inputTranscription?.text) {
      addMessage("user", inputTranscription.text);
    }

    const outputTranscription =
      serverContent.outputTranscription;

    if (outputTranscription?.text) {
      addMessage("ai", outputTranscription.text);
    }

    const modelTurn = serverContent.modelTurn;

    if (modelTurn?.parts) {
      setStatus("speaking");

      modelTurn.parts.forEach((part) => {
        const inlineData = part?.inlineData;

        if (inlineData?.data) {
          playGeminiAudio(inlineData.data);
        }
      });
    }

    if (serverContent.interrupted) {
      stopOutputAudio();

      if (isRunningRef.current) {
        setStatus("listening");
      }
    }

    if (serverContent.turnComplete) {
      if (audioSourcesRef.current.length === 0) {
        setStatus("listening");
      }
    }
  };

  const startMicrophone = async () => {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error(
        "আপনার browser AudioContext support করে না। Chrome বা Edge ব্যবহার করুন।"
      );
    }

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

    streamRef.current = stream;

    const audioContext = new AudioContextClass();

    audioContextRef.current = audioContext;

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const source =
      audioContext.createMediaStreamSource(stream);

    sourceRef.current = source;

    const processor =
      audioContext.createScriptProcessor(4096, 1, 1);

    processorRef.current = processor;

    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (
        !isRunningRef.current ||
        !sessionRef.current
      ) {
        return;
      }

      const inputData =
        event.inputBuffer.getChannelData(0);

      const resampled = resampleTo16k(
        inputData,
        audioContext.sampleRate
      );

      const pcm = floatTo16BitPCM(resampled);
      const base64Audio = arrayBufferToBase64(pcm);

      try {
        sessionRef.current.sendRealtimeInput({
          audio: {
            data: base64Audio,
            mimeType: "audio/pcm;rate=16000",
          },
        });
      } catch (sendError) {
        console.error("Audio send error:", sendError);
      }
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);
  };

  const startLive = async () => {
    setError("");
    setStatus("thinking");

    try {
      const session = await connectLive({
        onOpen: () => {
          console.log("Live session opened.");
        },

        onMessage: handleGeminiMessage,

        onError: (liveError) => {
          console.error(
            "Gemini Live error:",
            liveError
          );

          setError(
            liveError?.message ||
              "Gemini Live connection error হয়েছে।"
          );

          setStatus("error");
        },

        onClose: (event) => {
          console.log("Gemini Live closed:", event);
        },
      });

      sessionRef.current = session;
      isRunningRef.current = true;

      await startMicrophone();

      setIsListening(true);
      setStatus("listening");
    } catch (startError) {
      console.error("Start error:", startError);

      await stopLive(false);

      let message =
        startError?.message ||
        "Voice AI চালু করা যায়নি।";

      if (startError?.name === "NotAllowedError") {
        message =
          "Microphone permission দেওয়া হয়নি। Browser settings থেকে Microphone Allow করুন।";
      }

      if (startError?.name === "NotFoundError") {
        message = "কোনো microphone পাওয়া যায়নি।";
      }

      setError(message);
      setStatus("error");
      setIsListening(false);
    }
  };

  const stopLive = async (updateState = true) => {
    isRunningRef.current = false;

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;

      try {
        processorRef.current.disconnect();
      } catch {
        //
      }

      processorRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        //
      }

      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {
        //
      }

      audioContextRef.current = null;
    }

    stopOutputAudio();

    if (outputAudioContextRef.current) {
      try {
        await outputAudioContextRef.current.close();
      } catch {
        //
      }

      outputAudioContextRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (sessionError) {
        console.error(
          "Session close error:",
          sessionError
        );
      }

      sessionRef.current = null;
    }

    if (updateState) {
      setIsListening(false);
      setStatus("idle");
    }
  };

  const handleVoice = async () => {
    if (isListening) {
      await stopLive();
    } else {
      await startLive();
    }
  };

  const clearChat = async () => {
    await stopLive(false);

    setMessages([]);
    setError("");
    setIsListening(false);
    setStatus("idle");
  };

  useEffect(() => {
    return () => {
      isRunningRef.current = false;

      if (processorRef.current) {
        processorRef.current.onaudioprocess = null;

        try {
          processorRef.current.disconnect();
        } catch {
          //
        }
      }

      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          //
        }
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }

      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }

      if (outputAudioContextRef.current) {
        outputAudioContextRef.current
          .close()
          .catch(() => {});
      }

      if (sessionRef.current) {
        try {
          sessionRef.current.close();
        } catch {
          //
        }
      }
    };
  }, []);

  return (
    <div className="h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white">
      <header className="h-[76px] shrink-0 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div>
            <h1 className="text-xl font-extrabold sm:text-2xl md:text-3xl">
              Montu AI
            </h1>

            <p className="mt-1 text-xs text-gray-400 sm:text-sm">
              তোমার funny Bangla AI বন্ধু
            </p>
          </div>

          <button
            type="button"
            onClick={clearChat}
            className="rounded-xl bg-white/10 px-3 py-2 text-xs transition hover:bg-white/20 sm:text-sm"
          >
            🗑️
            <span className="hidden sm:inline">
              {" "}
              Clear Chat
            </span>
            <span className="sm:hidden"> Clear</span>
          </button>
        </div>
      </header>

      <main className="h-[calc(100vh-76px)] w-full overflow-hidden">
        <div className="mx-auto grid h-full max-w-7xl grid-cols-1 gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-2 lg:gap-8">
          <section className="hidden h-full min-h-0 overflow-y-auto rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-6">
            <Avatar status={status} />

            <Status status={status} />

            <VoiceButton
              isListening={isListening}
              onClick={handleVoice}
            />

            <p className="mt-4 text-center text-xs text-gray-500 sm:text-sm">
              {isListening
                ? "কথা বলো... আমি শুনছি 🎤"
                : "Microphone চাপ দিয়ে কথা শুরু করো"}
            </p>

            {error && (
              <p
                role="alert"
                className="mt-4 max-w-md px-2 text-center text-sm text-red-300"
              >
                {error}
              </p>
            )}
          </section>

          <section className="h-full min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
            <div className="h-full min-h-0 overflow-y-auto">
              <Chat messages={messages} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;


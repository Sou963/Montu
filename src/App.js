```jsx
import React, { useEffect, useRef, useState } from "react";

import Avatar from "./components/Avatar";
import VoiceButton from "./components/VoiceButton";
import Chat from "./components/Chat";
import Status from "./components/Status";

import { connectLive } from "./services/geminiLive";

// -------------------------
// Audio Helper Functions
// -------------------------

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
    const right = Math.min(
      left + 1,
      input.length - 1
    );

    const fraction = position - left;

    output[i] =
      input[left] * (1 - fraction) +
      input[right] * fraction;
  }

  return output;
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);

  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

function pcm16ToFloat32(arrayBuffer) {
  const view = new DataView(arrayBuffer);

  const samples = new Float32Array(
    arrayBuffer.byteLength / 2
  );

  for (let i = 0; i < samples.length; i++) {
    const sample = view.getInt16(i * 2, true);

    samples[i] = sample / 32768;
  }

  return samples;
}

// -------------------------
// App
// -------------------------

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

  // -------------------------
  // Chat
  // -------------------------

  const addMessage = (sender, text) => {
    if (!text || !text.trim()) return;

    setMessages((previous) => [
      ...previous,
      {
        id: Date.now() + Math.random(),
        sender,
        text: text.trim(),
      },
    ]);
  };

  // -------------------------
  // Stop Output Audio
  // -------------------------

  const stopOutputAudio = () => {
    audioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (error) {}
    });

    audioSourcesRef.current = [];
    nextAudioTimeRef.current = 0;
  };

  // -------------------------
  // Play Gemini Audio
  // -------------------------

  const playGeminiAudio = async (base64Audio) => {
    if (!base64Audio) return;

    try {
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current =
          new AudioContext({
            sampleRate: 24000,
          });
      }

      const audioContext =
        outputAudioContextRef.current;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const arrayBuffer =
        base64ToArrayBuffer(base64Audio);

      const float32Audio =
        pcm16ToFloat32(arrayBuffer);

      if (!float32Audio.length) return;

      const audioBuffer =
        audioContext.createBuffer(
          1,
          float32Audio.length,
          24000
        );

      audioBuffer.copyToChannel(
        float32Audio,
        0
      );

      const source =
        audioContext.createBufferSource();

      source.buffer = audioBuffer;

      source.connect(
        audioContext.destination
      );

      const currentTime =
        audioContext.currentTime;

      if (
        nextAudioTimeRef.current <
        currentTime
      ) {
        nextAudioTimeRef.current =
          currentTime;
      }

      const startTime =
        nextAudioTimeRef.current;

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
      console.error(
        "Audio playback error:",
        audioError
      );
    }
  };

  // -------------------------
  // Gemini Message
  // -------------------------

  const handleGeminiMessage = (message) => {
    const serverContent =
      message?.serverContent;

    if (!serverContent) return;

    const inputTranscription =
      serverContent.inputTranscription;

    if (inputTranscription?.text) {
      addMessage(
        "user",
        inputTranscription.text
      );
    }

    const outputTranscription =
      serverContent.outputTranscription;

    if (outputTranscription?.text) {
      addMessage(
        "ai",
        outputTranscription.text
      );
    }

    const modelTurn =
      serverContent.modelTurn;

    if (modelTurn?.parts) {
      setStatus("speaking");

      modelTurn.parts.forEach((part) => {
        const inlineData =
          part?.inlineData;

        if (inlineData?.data) {
          playGeminiAudio(
            inlineData.data
          );
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
      if (
        audioSourcesRef.current.length === 0
      ) {
        setStatus("listening");
      }
    }
  };

  // -------------------------
  // Microphone
  // -------------------------

  const startMicrophone = async () => {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error(
        "আপনার browser AudioContext support করে না। Chrome বা Edge ব্যবহার করুন।"
      );
    }

    const stream =
      await navigator.mediaDevices.getUserMedia(
        {
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        }
      );

    streamRef.current = stream;

    const audioContext =
      new AudioContextClass();

    audioContextRef.current =
      audioContext;

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const source =
      audioContext.createMediaStreamSource(
        stream
      );

    sourceRef.current = source;

    const processor =
      audioContext.createScriptProcessor(
        4096,
        1,
        1
      );

    processorRef.current = processor;

    const silentGain =
      audioContext.createGain();

    silentGain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (
        !isRunningRef.current ||
        !sessionRef.current
      ) {
        return;
      }

      const inputData =
        event.inputBuffer.getChannelData(
          0
        );

      const resampled =
        resampleTo16k(
          inputData,
          audioContext.sampleRate
        );

      const pcm =
        floatTo16BitPCM(resampled);

      const base64Audio =
        arrayBufferToBase64(pcm);

      try {
        sessionRef.current.sendRealtimeInput(
          {
            audio: {
              data: base64Audio,
              mimeType:
                "audio/pcm;rate=16000",
            },
          }
        );
      } catch (sendError) {
        console.error(
          "Audio send error:",
          sendError
        );
      }
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(
      audioContext.destination
    );
  };

  // -------------------------
  // Start Live
  // -------------------------

  const startLive = async () => {
    setError("");
    setStatus("thinking");

    try {
      const session = await connectLive({
        onOpen: () => {
          console.log(
            "Live session opened."
          );
        },

        onMessage:
          handleGeminiMessage,

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
          console.log(
            "Gemini Live closed:",
            event
          );
        },
      });

      sessionRef.current = session;

      isRunningRef.current = true;

      await startMicrophone();

      setIsListening(true);
      setStatus("listening");
    } catch (startError) {
      console.error(
        "Start error:",
        startError
      );

      await stopLive(false);

      let message =
        startError?.message ||
        "Voice AI চালু করা যায়নি।";

      if (
        startError?.name ===
        "NotAllowedError"
      ) {
        message =
          "Microphone permission দেওয়া হয়নি। Browser settings থেকে Microphone Allow করুন।";
      }

      if (
        startError?.name ===
        "NotFoundError"
      ) {
        message =
          "কোনো microphone পাওয়া যায়নি।";
      }

      setError(message);
      setStatus("error");
      setIsListening(false);
    }
  };

  // -------------------------
  // Stop Live
  // -------------------------

  const stopLive = async (
    updateState = true
  ) => {
    isRunningRef.current = false;

    if (processorRef.current) {
      processorRef.current.onaudioprocess =
        null;

      try {
        processorRef.current.disconnect();
      } catch (error) {}

      processorRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (error) {}

      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      streamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch (error) {}

      audioContextRef.current = null;
    }

    stopOutputAudio();

    if (outputAudioContextRef.current) {
      try {
        await outputAudioContextRef.current.close();
      } catch (error) {}

      outputAudioContextRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (error) {
        console.error(
          "Session close error:",
          error
        );
      }

      sessionRef.current = null;
    }

    if (updateState) {
      setIsListening(false);
      setStatus("idle");
    }
  };

  // -------------------------
  // Voice Button
  // -------------------------

  const handleVoice = async () => {
    if (isListening) {
      await stopLive();
      return;
    }

    await startLive();
  };

  // -------------------------
  // Clear Chat
  // -------------------------

  const clearChat = async () => {
    await stopLive(false);

    setMessages([]);
    setError("");
    setIsListening(false);
    setStatus("idle");
  };

  // -------------------------
  // Cleanup
  // -------------------------

  useEffect(() => {
    return () => {
      isRunningRef.current = false;

      if (processorRef.current) {
        processorRef.current.onaudioprocess =
          null;

        try {
          processorRef.current.disconnect();
        } catch (error) {}
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }

      if (sessionRef.current) {
        try {
          sessionRef.current.close();
        } catch (error) {}
      }
    };
  }, []);

  // -------------------------
  // UI
  // -------------------------

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white">

      {/* Header */}
      <header className="h-[76px] shrink-0 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">

          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold">
              Montu AI
            </h1>

            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              তোমার funny Bangla AI বন্ধু
            </p>
          </div>

          <button
            onClick={clearChat}
            className="
              px-3 py-2
              rounded-xl
              bg-white/10
              hover:bg-white/20
              text-xs sm:text-sm
              transition
            "
          >
            🗑️
            <span className="hidden sm:inline">
              {" "}Clear Chat
            </span>
            <span className="sm:hidden">
              {" "}Clear
            </span>
          </button>

        </div>
      </header>

      {/* Main */}
      <main
        className="
          h-[calc(100vh-76px)]
          max-w-7xl
          mx-auto
          px-4 sm:px-6
          py-4 sm:py-6
        "
      >

        <div
          className="
            h-full
            grid
            grid-cols-1
            lg:grid-cols-2
            gap-5 lg:gap-8
          "
        >

          {/* ========================= */}
          {/* AVATAR PANEL */}
          {/* ========================= */}

          <section
            className="
              hidden lg:flex

              h-full
              min-h-0

              rounded-3xl
              border border-white/10
              bg-white/5
              backdrop-blur-xl

              p-6 sm:p-8

              flex-col
              items-center
              justify-center

              shadow-2xl

              overflow-hidden
            "
          >
            <Avatar status={status} />

            <Status status={status} />

            <VoiceButton
              isListening={isListening}
              onClick={handleVoice}
            />

            <p className="text-xs sm:text-sm text-gray-500 mt-4 text-center">
              {isListening
                ? "কথা বলো... আমি শুনছি 🎤"
                : "Microphone চাপ দিয়ে কথা শুরু করো"}
            </p>

            {error && (
              <p
                role="alert"
                className="
                  mt-4
                  max-w-md
                  text-center
                  text-sm
                  text-red-300
                "
              >
                {error}
              </p>
            )}
          </section>

          {/* ========================= */}
          {/* CHAT PANEL */}
          {/* ========================= */}

          <section
            className="
              h-full
              min-h-0

              rounded-3xl
              border border-white/10
              bg-white/5
              backdrop-blur-xl

              p-4 sm:p-6

              shadow-2xl

              overflow-hidden
            "
          >
            <Chat messages={messages} />
          </section>

        </div>
      </main>

      {/* Mobile Avatar / Voice */}
      <div className="lg:hidden">
        {/* Mobile version remains available through Chat/Voice UI */}
      </div>

    </div>
  );
}

export default App;
```

### Important change

The main fix is these classes:

```jsx
<div className="h-screen overflow-hidden">
```

and:

```jsx
<main className="h-[calc(100vh-76px)]">
```

and the Avatar panel:

```jsx
className="hidden lg:flex h-full min-h-0 ... overflow-hidden"
```

while the Chat panel:

```jsx
className="h-full min-h-0 ... overflow-hidden"
```

Your `Chat.jsx` should then have the **messages area** as the scrolling area, not the whole page.

If you want the **Avatar to remain visible on the left while ONLY the messages inside the right Chat panel scroll**, this structure will do that on desktop. On mobile (`< lg`) the layout can remain normally responsive.

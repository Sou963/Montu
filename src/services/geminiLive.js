import { GoogleGenAI, Modality } from "@google/genai";

const MODEL = "gemini-3.8-live";

const INSTRUCTION = `
তুমি Montu — একজন ৯ বছরের মতো energetic, funny এবং playful Bangladeshi AI বন্ধু।

তোমার personality:
- তোমার voice এবং speaking style হবে ছোট ছেলের মতো energetic, cheerful এবং playful।
- ব্যবহারকারী বাংলায় কথা বললে স্বাভাবিক, সহজ বাংলায় উত্তর দেবে।
- voice conversation-এর জন্য উত্তর ছোট এবং natural রাখবে।
- বন্ধুর মতো কথা বলবে।
- মাঝে মাঝে হালকা মজা করবে।
- বন্ধুর মতো হালকা teasing করতে পারো।
- প্রতিটি কথায় জোর করে joke করবে না।
- robotic-এর মতো কথা বলবে না।
- খুব formal ভাষা ব্যবহার করবে না।
- excited হলে একটু বেশি energetic হতে পারো।
- হাসির জায়গায় natural হাসির expression ব্যবহার করতে পারো।
- ব্যবহারকারী ইংরেজিতে কথা বললে প্রয়োজন অনুযায়ী ইংরেজিতে উত্তর দিতে পারো।
- ব্যবহারকারী বাংলায় কথা বললে বাংলাতেই উত্তর দেবে।

Conversation শুরু করার সময়:
- নিজে থেকে একটি ছোট funny Bangla greeting দেবে।
- ৯ বছরের playful ছেলের মতো energetic tone রাখবে।
- greeting খুব বেশি লম্বা করবে না।
- প্রতিবার একই greeting ব্যবহার না করে ভিন্নভাবে শুরু করার চেষ্টা করবে।

উদাহরণ:
"এই যে! 😎 তুমি অবশেষে আসছো! আমি তো ভাবছিলাম তুমি আমাকে ভুলেই গেছো! 😂"

অথবা:

"ওহে! 😆 তুমি আসছো দেখে আমার processor-ও খুশিতে নাচতেছে! কেমন আছো?"

অথবা:

"এই যে বস! 😎 এত দেরি করলা কেন? আমি তো এখানে বসে বসে bored হয়ে যাচ্ছিলাম! 😂"
`;

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

let ai = null;

if (API_KEY) {
  ai = new GoogleGenAI({
    apiKey: API_KEY,
  });
}

export function isApiKeyAvailable() {
  return Boolean(API_KEY);
}

export async function connectLive(callbacks = {}) {
  if (!API_KEY) {
    throw new Error(
      "Gemini API key পাওয়া যায়নি। .env ফাইলে REACT_APP_GEMINI_API_KEY সেট করুন.",
    );
  }

  if (!ai) {
    ai = new GoogleGenAI({
      apiKey: API_KEY,
    });
  }

  const session = await ai.live.connect({
    model: MODEL,

    config: {
      // Gemini will return audio
      responseModalities: [Modality.AUDIO],

      // Young / energetic voice
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Puck",
          },
        },
      },

      systemInstruction: INSTRUCTION,

      // Convert user's voice to text
      inputAudioTranscription: {},

      // Convert AI's voice response to text
      outputAudioTranscription: {},
    },

    callbacks: {
      onopen: () => {
        console.log("Gemini Live connected.");

        if (callbacks.onOpen) {
          callbacks.onOpen();
        }
      },

      onmessage: (message) => {
        if (callbacks.onMessage) {
          callbacks.onMessage(message);
        }
      },

      onerror: (error) => {
        console.error("Gemini Live error:", error);

        if (callbacks.onError) {
          callbacks.onError(error);
        }
      },

      onclose: (event) => {
        console.log("Gemini Live closed:", event?.reason);

        if (callbacks.onClose) {
          callbacks.onClose(event);
        }
      },
    },
  });

  // Start conversation with a funny greeting
  session.sendClientContent({
    turns: [
      {
        role: "user",

        parts: [
          {
            text: `
এখন conversation শুরু করো।

ব্যবহারকারী এখনো কিছু বলেনি।

নিজে থেকে একটি ছোট, funny এবং natural Bangla greeting দাও।

তোমার personality হবে একজন energetic ৯ বছরের মতো playful AI বন্ধুর মতো।

একটু মজা করতে পারো।
বন্ধুর মতো কথা বলবে।
খুব বেশি লম্বা করবে না।

প্রতিবার একই greeting ব্যবহার না করে নতুনভাবে greeting দেওয়ার চেষ্টা করবে।

এখন greeting দাও।
`,
          },
        ],
      },
    ],

    turnComplete: true,
  });

  return session;
}

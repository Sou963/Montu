import React from "react";

function Status({ status }) {
  const statusData = {
    idle: {
      text: "কথা বলার জন্য প্রস্তুত",
      color: "bg-gray-400",
    },

    listening: {
      text: "আমি শুনছি...",
      color: "bg-green-400",
    },

    thinking: {
      text: "একটু ভাবছি...",
      color: "bg-yellow-400",
    },

    speaking: {
      text: "আমি বলছি...",
      color: "bg-blue-400",
    },

    laughing: {
      text: "হাহাহা! 🤣",
      color: "bg-pink-400",
    },
    error: {
      text: "সমস্যা হয়েছে",
      color: "bg-red-400",
    },
  };

  const current = statusData[status] || statusData.idle;

  return (
    <div className="flex items-center justify-center gap-2 mt-5">
      <span
        className={`
          w-2.5 h-2.5
          rounded-full
          ${current.color}
          ${status !== "idle" ? "animate-pulse" : ""}
        `}
      ></span>

      <span className="text-sm sm:text-base text-gray-300">{current.text}</span>
    </div>
  );
}

export default Status;

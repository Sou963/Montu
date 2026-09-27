import React from "react";

function VoiceButton({ isListening, onClick }) {
  return (
    <div className="relative flex items-center justify-center mt-8">
      {isListening && (
        <>
          <div className="absolute w-24 h-24 rounded-full bg-red-500/20 animate-ping"></div>

          <div className="absolute w-20 h-20 rounded-full bg-red-500/20"></div>
        </>
      )}

      <button
        onClick={onClick}
        type="button"
        aria-label={isListening ? "ভয়েস বন্ধ করুন" : "ভয়েস চালু করুন"}
        className={`
          relative z-10
          w-20 h-20
          sm:w-24 sm:h-24
          rounded-full
          flex items-center justify-center
          text-3xl sm:text-4xl
          text-white
          shadow-xl
          transition-all duration-300
          hover:scale-105
          active:scale-95
          ${
            isListening
              ? "bg-red-500 hover:bg-red-600"
              : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-purple-600 hover:to-pink-600"
          }
        `}
      >
        {isListening ? "(﹙˓ ‍🎧 ˒﹚)" : "🎙️"}
      </button>
    </div>
  );
}

export default VoiceButton;

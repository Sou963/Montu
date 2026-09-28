import React from "react";
import Avatargif from "../assets/avatar.gif";

function Avatar({ status = "idle", avatarGif = true }) {
  const avatarData = {
    idle: {
      emoji: "🤖",
      animation: "",
    },
    listening: {
      emoji: "👂🤖",
      animation: "animate-pulse",
    },
    thinking: {
      emoji: "🤔",
      animation: "animate-bounce",
    },
    speaking: {
      emoji: "🗣️🤖",
      animation: "animate-pulse",
    },
    laughing: {
      emoji: "🤣",
      animation: "animate-bounce",
    },
  };

  const current = avatarData[status] || avatarData.idle;

  return (
    <div className="flex w-full flex-col items-center px-2 py-2 sm:px-4 sm:py-3">
      <div
        className={`
          ${current.animation}
          flex
          h-24
          w-24
          shrink-0
          items-center
          justify-center
          overflow-hidden
          rounded-full
          border-4
          border-white/20
          bg-gradient-to-br
          from-purple-500
          via-pink-500
          to-orange-400
          shadow-2xl
          shadow-purple-500/30
          transition-all
          duration-300
          sm:h-32
          sm:w-32
          md:h-36
          md:w-36
          lg:h-44
          lg:w-44
          xl:h-48
          xl:w-48
        `}
      >
        {avatarGif ? (
          <img
            src={Avatargif}
            alt="Montu AI Avatar"
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className="
              select-none
              text-4xl
              sm:text-5xl
              md:text-6xl
              lg:text-7xl
              xl:text-8xl
            "
          >
            {current.emoji}
          </span>
        )}
      </div>

      <h2
        className="
          mt-2
          text-base
          font-bold
          text-center
          text-white
          sm:mt-3
          sm:text-lg
          md:text-xl
          lg:text-2xl
        "
      >
        Montu
      </h2>

      <p
        className="
          mt-1
          text-center
          text-[11px]
          text-gray-400
          sm:text-xs
          md:text-sm
        "
      >
        তোমার AI বন্ধু
      </p>
    </div>
  );
}

export default Avatar;

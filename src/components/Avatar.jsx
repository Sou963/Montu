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

  const current =
    avatarData[status] || avatarData.idle;

  return (
    <div className="w-full flex flex-col items-center px-4 py-6">

      {/* Avatar */}
      <div
        className={`
          ${current.animation}

          w-32 h-32
          sm:w-44 sm:h-44
          md:w-52 md:h-52
          lg:w-60 lg:h-60

          rounded-full

          flex
          items-center
          justify-center

          overflow-hidden

          bg-gradient-to-br
          from-purple-500
          via-pink-500
          to-orange-400

          border-4
          border-white/20

          shadow-2xl
          shadow-purple-500/30

          transition-all
          duration-300

          shrink-0
        `}
      >
        {avatarGif ? (
          <img
            src={Avatargif}
            alt="Montu AI Avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className="
              text-5xl
              sm:text-7xl
              md:text-8xl
              lg:text-9xl
              select-none
            "
          >
            {current.emoji}
          </span>
        )}
      </div>

      {/* Name */}
      <h2
        className="
          mt-4
          sm:mt-5
          text-lg
          sm:text-xl
          md:text-2xl
          font-bold
          text-white
          text-center
        "
      >
        Montu
      </h2>

      {/* Subtitle */}
      <p
        className="
          mt-1
          text-xs
          sm:text-sm
          text-gray-400
          text-center
        "
      >
        তোমার AI বন্ধু
      </p>

    </div>
  );
}

export default Avatar;
```

### Most important: change `App.jsx`

Find your Avatar `<section>`:

```jsx
<section
  className="
    hidden lg:flex
    h-full
    min-h-0
    ...
    overflow-hidden
  "
>
```

Change **only** `overflow-hidden` to:

```jsx
overflow-y-auto
```

So:

```jsx
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

    overflow-y-auto
  "
>

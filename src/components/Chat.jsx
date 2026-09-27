import React from "react";

function Chat({ messages }) {
  return (
    <div className="flex flex-col w-full h-[400px] sm:h-[450px] lg:h-full">
      {/* Header */}
      <div className="pb-3 sm:pb-4 border-b border-white/10 shrink-0">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-white">
          💬 Conversation
        </h2>

        <p className="text-xs sm:text-sm text-gray-500 mt-1">তোমাদের কথোপকথন</p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto py-3 sm:py-4 space-y-3 sm:space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">
              💬
            </div>

            <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white">
              চলো কথা বলি!
            </h3>

            <p className="text-xs sm:text-sm text-gray-500 mt-2 max-w-[260px] sm:max-w-xs leading-relaxed">
              Microphone button চাপো এবং আমার সাথে বাংলায় কথা বলো।
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`
                  max-w-[88%]
                  sm:max-w-[80%]
                  md:max-w-[75%]

                  rounded-2xl

                  px-3.5 py-2.5
                  sm:px-4 sm:py-3

                  ${
                    message.sender === "user"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-gray-800 text-gray-100 rounded-bl-md"
                  }
                `}
              >
                <p className="text-[11px] sm:text-xs opacity-60 mb-1">
                  {message.sender === "user" ? "তুমি" : "🤖 Montu"}
                </p>

                <p className="text-sm sm:text-base leading-relaxed break-words">
                  {message.text}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Chat;

export default function FreerideLogo({
  size = "md",
  className = ""
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeMap = {
    sm: "w-8 h-8 rounded-lg",
    md: "w-10 h-10 rounded-xl",
    lg: "w-14 h-14 rounded-2xl"
  };

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#C026D3] shadow-lg shadow-purple-600/30 overflow-hidden ${sizeMap[size]} ${className}`}
    >
      {/* Subtle background glow ring */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

      {/* Vector Cyclist / Freeride Monogram */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[62%] h-[62%] text-white drop-shadow-sm"
      >
        {/* Rear Wheel */}
        <circle cx="5.5" cy="17.5" r="3.25" stroke="currentColor" strokeWidth="2" />
        {/* Front Wheel */}
        <circle cx="18.5" cy="17.5" r="3.25" stroke="currentColor" strokeWidth="2" />
        {/* Rider Head */}
        <circle cx="15" cy="5" r="1.5" fill="currentColor" />
        {/* Frame Triangle */}
        <path
          d="M5.5 17.5L10 10.5H14L18.5 17.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 10.5L12 17.5L14 10.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Rider Body & Cockpit */}
        <path
          d="M10.5 10.5L13.5 6.5L16.5 7.5L18 10.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

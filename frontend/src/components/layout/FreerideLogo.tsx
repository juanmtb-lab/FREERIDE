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
      className={`relative flex items-center justify-center shrink-0 bg-gradient-to-tr from-[#7C3AED] via-[#8B5CF6] to-[#6D28D9] shadow-lg shadow-purple-600/30 overflow-hidden ${sizeMap[size]} ${className}`}
    >
      {/* Subtle background ambient shine */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

      {/* Clean Minimalist Bicycle Silhouette */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[72%] h-[72%] text-white drop-shadow-sm"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Rear Wheel */}
        <circle cx="5.5" cy="16.5" r="3.5" />
        {/* Front Wheel */}
        <circle cx="18.5" cy="16.5" r="3.5" />
        
        {/* Chainstay: Rear Hub to BB */}
        <line x1="5.5" y1="16.5" x2="11.5" y2="16.5" />
        
        {/* Seatstay: Rear Hub to Seat Cluster */}
        <line x1="5.5" y1="16.5" x2="9" y2="10" />
        
        {/* Seat Tube: Seat Cluster to BB */}
        <line x1="9" y1="10" x2="11.5" y2="16.5" />
        
        {/* Top Tube: Seat Cluster to Head Tube */}
        <line x1="9" y1="10" x2="15.5" y2="10" />
        
        {/* Down Tube: Head Tube to BB */}
        <line x1="15.5" y1="10" x2="11.5" y2="16.5" />
        
        {/* Fork: Head Tube to Front Hub */}
        <line x1="15.5" y1="10" x2="18.5" y2="16.5" />
        
        {/* Saddle */}
        <line x1="9" y1="10" x2="8.7" y2="8.5" />
        <line x1="7.2" y1="8.5" x2="10.2" y2="8.5" strokeWidth="2.1" />
        
        {/* Handlebars */}
        <line x1="15.5" y1="10" x2="16" y2="7.8" />
        <line x1="14.8" y1="7.8" x2="17.5" y2="7.8" strokeWidth="2.1" />
      </svg>
    </div>
  );
}

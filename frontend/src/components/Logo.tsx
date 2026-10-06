import { useState } from "react";

export default function Logo({ size = 32, showWordmark = true, className = "", dark = false }: { size?: number; showWordmark?: boolean; className?: string; dark?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {!imageFailed ? (
        <img
          src="/logo.png"
          alt="Cogniitec"
          style={{ height: size, width: "auto" }}
          className="object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          style={{ height: size, width: size }}
          className="flex items-center justify-center rounded-lg bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] text-white font-bold shadow-lg shadow-[#6D28D9]/30"
        >
          <span style={{ fontSize: size * 0.5 }}>C</span>
        </div>
      )}
      {showWordmark && (
        <div>
          <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-[#24113F]'}`}>Cogniitec</span>
          <span className={`text-xs block ${dark ? 'text-[#D8CCEA]' : 'text-[#7C6F95]'}`}>School ERP System</span>
        </div>
      )}
    </div>
  );
}

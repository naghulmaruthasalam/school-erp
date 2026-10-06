import { useState } from "react";

export default function Logo({ size = 32, showWordmark = true, className = "", dark = false }: { size?: number; showWordmark?: boolean; className?: string; dark?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {!imageFailed ? (
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="Cogniitec"
          style={{ height: size, width: "auto" }}
          className="object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          style={{ height: size, width: size }}
          className="flex items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-white font-bold shadow-lg shadow-accent/30"
        >
          <span style={{ fontSize: size * 0.5 }}>C</span>
        </div>
      )}
      {showWordmark && (
        <div>
          <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-ink'}`}>Cogniitec</span>
          <span className={`text-xs block ${dark ? 'text-ink-2' : 'text-ink-3'}`}>School ERP System</span>
        </div>
      )}
    </div>
  );
}

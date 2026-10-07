import { useEffect, useRef, useState } from "react";

interface EyeFollowingEmojiProps {
  className?: string;
}

export function EyeFollowingEmoji({ className = "" }: EyeFollowingEmojiProps) {
  const leftPupilRef = useRef<HTMLDivElement>(null);
  const rightPupilRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHappy, setIsHappy] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !leftPupilRef.current || !rightPupilRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const distance = Math.min(
        Math.hypot(e.clientX - centerX, e.clientY - centerY) / 20,
        5
      );

      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      leftPupilRef.current.style.transform = `translate(${x}px, ${y}px)`;
      rightPupilRef.current.style.transform = `translate(${x}px, ${y}px)`;

      // Happy when cursor is close
      const isClose = Math.hypot(e.clientX - centerX, e.clientY - centerY) < 150;
      setIsHappy(isClose);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`eye-following-container ${className}`}
      aria-hidden="true"
    >
      <div className="eye-emoji-face relative">
        <div className="eye-emoji-eyes">
          <div className="eye-emoji-eye">
            <div ref={leftPupilRef} className="eye-emoji-pupil" />
          </div>
          <div className="eye-emoji-eye">
            <div ref={rightPupilRef} className="eye-emoji-pupil" />
          </div>
        </div>
        <div
          className={`eye-emoji-mouth transition-all duration-300 ${
            isHappy ? "w-8 h-4 border-b-4" : ""
          }`}
        />
        <div className="eye-emoji-blush eye-emoji-blush-left" />
        <div className="eye-emoji-blush eye-emoji-blush-right" />
      </div>
    </div>
  );
}

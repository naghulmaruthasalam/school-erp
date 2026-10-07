interface FloatingShapesProps {
  className?: string;
}

export function FloatingShapes({ className = "" }: FloatingShapesProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      <div
        className="floating-shape floating-shape-1"
        style={{ top: "10%", left: "-5%" }}
      />
      <div
        className="floating-shape floating-shape-2"
        style={{ top: "60%", right: "-3%" }}
      />
      <div
        className="floating-shape floating-shape-3"
        style={{ bottom: "15%", left: "20%" }}
      />
      <div
        className="floating-shape floating-shape-1"
        style={{ bottom: "-5%", right: "30%", animationDelay: "-3s" }}
      />
      <div
        className="floating-shape floating-shape-2"
        style={{ top: "25%", right: "15%", animationDelay: "-5s" }}
      />
    </div>
  );
}

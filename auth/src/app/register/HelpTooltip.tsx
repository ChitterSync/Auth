import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";

interface HelpTooltipProps {
  tooltip: React.ReactNode;
  children: React.ReactNode;
}

export default function HelpTooltip({ tooltip, children }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);

  const showTooltip = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
      });
    }
    setVisible(true);
  };

  const hideTooltip = () => setVisible(false);

  return (
    <>
      <span
        ref={iconRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        tabIndex={0}
        className="inline-flex items-center"
      >
        {children}
      </span>
      {visible &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[9999] px-3 py-2 rounded bg-gray-800 text-white text-xs shadow-lg"
            style={{
              top: coords.top,
              left: coords.left,
              whiteSpace: "pre-line",
              pointerEvents: "none",
            }}
          >
            {Array.isArray(tooltip)
              ? tooltip.map((item, i) => {
                  if (typeof item === "string") return <span key={i}>{item}</span>;
                  // If it's a valid React element, just render it (don't clone)
                  if (React.isValidElement(item)) return <span key={i} style={{ display: "inline-flex", verticalAlign: "middle" }}>{item}</span>;
                  return <span key={i}>{String(item)}</span>;
                })
              : tooltip}
          </div>,
          document.body
        )}
    </>
  );
}

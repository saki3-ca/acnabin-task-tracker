import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface InstantTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const InstantTooltip: React.FC<InstantTooltipProps> = ({
  content,
  children,
  className = '',
  style = {}
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; isFlipped: boolean }>({
    top: 0,
    left: 0,
    isFlipped: false
  });
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!triggerRef.current || !content) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    const isFlipped = rect.top < 90;
    const top = isFlipped ? rect.bottom + scrollTop + 8 : rect.top + scrollTop - 8;
    
    // Clamp horizontal position so tooltip doesn't bleed off screen
    const rawLeft = rect.left + scrollLeft + rect.width / 2;
    const minLeft = 180;
    const maxLeft = Math.max(window.innerWidth - 180, minLeft);
    const left = Math.max(minLeft, Math.min(rawLeft, maxLeft));

    setCoords({ top, left, isFlipped });
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  if (!content) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <>
      <div
        ref={triggerRef}
        className={className}
        style={{ ...style, cursor: 'pointer' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>

      {isVisible &&
        createPortal(
          <div
            style={{
              position: 'absolute',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: coords.isFlipped ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
              backgroundColor: '#0F172A',
              color: '#F8FAFC',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              lineHeight: '1.45',
              maxWidth: '380px',
              minWidth: '120px',
              width: 'max-content',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35), 0 4px 10px rgba(0, 0, 0, 0.2)',
              zIndex: 999999,
              pointerEvents: 'none',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              border: '1px solid #334155'
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
};

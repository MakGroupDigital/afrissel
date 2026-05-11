import React from 'react';

export function InvertedAfricaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Concentric circles */}
      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 4" strokeOpacity="0.3" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.4" />
      <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.5" />
      
      {/* Crosshairs */}
      <line x1="50" y1="0" x2="50" y2="100" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />

      {/* Upward traction lines (les deux traits supérieurs) */}
      <path d="M30 10 L45 20 M70 10 L55 20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.8" strokeLinecap="round" />
      
      {/* Container Box with rounded corners (le contour carré) */}
      <rect x="5" y="5" width="90" height="90" rx="10" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.6" />

      {/* Simplified Africa Map Path (rotated 180 degrees) */}
      <g transform="rotate(180, 50, 50)">
        <path 
           d="M32 30 C35 25, 45 20, 50 20 C60 20, 75 35, 75 45 C75 55, 65 70, 55 85 C50 90, 45 80, 45 70 C40 60, 35 55, 30 50 C25 45, 20 40, 20 50 C20 40, 25 35, 32 30 Z" 
           fill="currentColor" 
           stroke="currentColor" 
           strokeWidth="1" 
           fillOpacity="0.9"
        />
      </g>

      {/* Central Green Dot (Le point central vert) */}
      <circle cx="50" cy="50" r="4" fill="#15EA3E" />
    </svg>
  );
}

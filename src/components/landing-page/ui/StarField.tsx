import React, { useState, useEffect, useCallback } from "react";

// Decorative only — hidden from assistive tech, never intercepts pointer events.
// Supports reduced-motion, tab visibility, and mobile viewport optimization.

const allStars = [
  { left: 1056.99, top: 101.12, opacity: 0.57 },
  { left: 1184.99, top: 65.96, opacity: 0.76 },
  { left: 1262.27, top: 384.25, opacity: 0.5 },
  { left: 1244.49, top: 760.36, opacity: 0.5 },
  { left: 1106.39, top: 491.99, opacity: 0.48 },
  { left: 1673.55, top: 420.08, opacity: 0.32 },
  { left: 1213.98, top: 138.09, opacity: 0.49 },
  { left: 1442.22, top: 560.82, opacity: 0.5 },
  { left: 137.27, top: 665.89, opacity: 0.52 },
  { left: 753.6, top: 297.23, opacity: 0.74 },
  { left: 1161.86, top: 201.46, opacity: 0.54 },
  { left: 588.59, top: 58.3, opacity: 0.5 },
  { left: 429.48, top: 459.12, opacity: 0.56 },
  { left: 516.73, top: 169.97, opacity: 0.51 },
  { left: 1554.68, top: 177.07, opacity: 0.64 },
  { left: 954.5, top: 445.08, opacity: 0.71 },
  { left: 890.83, top: 497.85, opacity: 0.5 },
  { left: 116.18, top: 423.7, opacity: 0.51 },
  { left: 303.9, top: 361.55, opacity: 0.36 },
  { left: 350.48, top: 589.11, opacity: 0.52 },
  { left: 398.97, top: 715.02, opacity: 0.41 },
  { left: 1441.23, top: 769.03, opacity: 0.74 },
  { left: 1564.96, top: 441.88, opacity: 0.54 },
  { left: 449.34, top: 508.13, opacity: 0.53 },
  { left: 151.15, top: 417.8, opacity: 0.59 },
  { left: 977.83, top: 433.46, opacity: 0.59 },
  { left: 620.28, top: 595.82, opacity: 0.75 },
  { left: 1437.05, top: 216.94, opacity: 0.88 },
  { left: 493.99, top: 269.89, opacity: 0.4 },
  { left: 1670.1, top: 642.08, opacity: 0.7 },
  { left: 1537.89, top: 116.63, opacity: 0.58 },
  { left: 623.52, top: 343.93, opacity: 0.56 },
  { left: 1161.36, top: 515.88, opacity: 0.5 },
  { left: 1585.82, top: 637.25, opacity: 0.73 },
  { left: 969.15, top: 533.25, opacity: 0.87 },
  { left: 1518.53, top: 426.41, opacity: 0.51 },
  { left: 830.63, top: 443.06, opacity: 0.67 },
  { left: 693.02, top: 533.59, opacity: 0.5 },
  { left: 477.45, top: 585.76, opacity: 0.5 },
  { left: 419.18, top: 471.07, opacity: 0.56 },
  { left: 1331.15, top: 272.65, opacity: 0.46 },
  { left: 1467.01, top: 289.85, opacity: 0.52 },
  { left: 802.38, top: 477.4, opacity: 0.5 },
  { left: 928.59, top: 65.16, opacity: 0.82 },
  { left: 483.46, top: 254.67, opacity: 0.74 },
  { left: 185.49, top: 285.42, opacity: 0.5 },
  { left: 205.69, top: 380.84, opacity: 0.58 },
  { left: 379.67, top: 382.82, opacity: 0.66 },
  { left: 1464.68, top: 211.28, opacity: 0.5 },
  { left: 1007.94, top: 714.24, opacity: 0.51 },
];

export const StarField: React.FC = () => {
  const [isReduced, setIsReduced] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);

  // Detect and monitor prefers-reduced-motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Set initial state
    setIsReduced(mediaQuery.matches);

    // Handle runtime changes
    const handleChange = (e: MediaQueryListEvent) => {
      setIsReduced(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  // Pause animation when tab becomes hidden, resume when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsAnimating(false);
      } else if (!isReduced) {
        // Resume animation only if reduced-motion is not active
        setIsAnimating(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isReduced]);

  // Determine star count based on viewport width
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const starCount = isMobile ? 40 : 150;
  const starsToDraw = allStars.slice(0, starCount);

  // Determine animation state: show animation only if reduced-motion is off and tab is visible
  const shouldAnimate = !isReduced && isAnimating;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden hidden md:block pointer-events-none"
    >
      {starsToDraw.map((star, index) => (
        <div
          key={index}
          className={`absolute bg-white rounded-full w-[0.998px] h-[0.998px] ${
            shouldAnimate ? "motion-safe:animate-pulse" : ""
          }`}
          style={{
            left: `${(star.left / 1680) * 100}%`,
            top: `${(star.top / 823.333) * 100}%`,
            opacity: star.opacity,
          }}
        />
      ))}
    </div>
  );
};
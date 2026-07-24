"use client";

import { useEffect, useState, type JSX } from "react";
import { ArrowUp } from "lucide-react";

const VISIBILITY_THRESHOLD_PX = 300;

export default function ScrollToTopButton(): JSX.Element | null {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect((): (() => void) => {
    const handleScroll = (): void => {
      setIsVisible(window.scrollY > VISIBILITY_THRESHOLD_PX);
    };

    window.addEventListener("scroll", handleScroll);

    return (): void => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleScrollToTop = (): void => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleScrollToTop}
      className="fixed bottom-6 right-6 p-3 rounded-full bg-[#0ff0fc] hover:bg-[#0a7a82] text-white transition-all duration-300 z-50 hover:scale-105 hover:cursor-pointer shadow-xl shadow-black/50"
      aria-label="Scroll to top"
    >
      <ArrowUp className="w-5 h-5 animate-bounce" />
    </button>
  );
}

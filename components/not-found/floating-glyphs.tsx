"use client";

import { Brain, Star, Zap } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * The 404's randomised background glyphs, extracted so `app/not-found.tsx` can stay a
 * server module and read `data/pages/not-found.ts` without putting zod in the browser
 * bundle. Positions come from `Math.random()` **after mount**, never during render — a
 * random number in a render path is a hydration mismatch.
 *
 * The tints are the 404's ground ink (issue #187), not three palette steps: the layer used to
 * draw purple 300, blue 300 and indigo 300 glyphs, which put two banned hues back on the
 * one page the issue's acceptance names, at 20% opacity, on top of a ground that is now the
 * brand's ink. One decoration is one colour — `text-background` under `opacity-20` — and a
 * single tint means the layer cannot reintroduce the palette a stage at a time.
 */
export function FloatingGlyphs() {
  const [floatingElements, setFloatingElements] = useState<
    Array<{ id: number; x: number; y: number; delay: number }>
  >([]);

  useEffect(() => {
    const elements = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }));
    setFloatingElements(elements);
  }, []);

  return (
    <div className="absolute inset-0">
      {floatingElements.map((element) => (
        <div
          key={element.id}
          className="absolute animate-pulse"
          style={{
            left: `${element.x}%`,
            top: `${element.y}%`,
            animationDelay: `${element.delay}s`,
          }}
        >
          {element.id % 3 === 0 && <Brain className="w-6 h-6 text-background opacity-20" />}
          {element.id % 3 === 1 && <Zap className="w-4 h-4 text-background opacity-20" />}
          {element.id % 3 === 2 && <Star className="w-5 h-5 text-background opacity-20" />}
        </div>
      ))}
    </div>
  );
}

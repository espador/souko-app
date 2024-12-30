// Text-Generate-Effect.tsx
"use client";
import React, { useEffect } from 'react';
import { motion, stagger, useAnimate } from "framer-motion";
import { cn } from "../../styles/components/utils.ts";

interface TextGenerateEffectProps {
  words: string | undefined;
  className?: string;
  filter?: boolean;
  duration?: number;
}

export const TextGenerateEffect = ({
  words,
  className,
  filter = true,
  duration = 0.5,
}: TextGenerateEffectProps) => {
  const [scope, animate] = useAnimate();
  let linesArray = words ? words.split("\n") : [];

  useEffect(() => {
    if (scope.current && linesArray.length > 0) {
      animate("div", {
        opacity: 1,
        filter: filter ? "blur(0px)" : "none",
      }, {
        duration: duration ? duration : 1,
        delay: stagger(0.2),
      });
    }
  }, [scope, animate, filter, duration, linesArray.length]); // Added scope to the dependency array

  const renderLines = () => {
    return (
      <motion.div
        ref={scope}
        initial={{ opacity: 0 }} // Start with opacity 0
        animate={{ opacity: 1, transition: { staggerChildren: 0.2 } }}
      >
        {linesArray.map((line, idx) => {
          const parts = line.split("<span class=\"accent-text\">");
          const before = parts[0];
          const middleParts = parts.length > 1 ? parts[1].split("</span>") : [];
          const middle = middleParts[0];
          const after = middleParts.length > 1 ? middleParts[1] : "";

          return (
            <motion.div key={idx} className="dark:text-white text-black" style={{ filter: filter ? "blur(5px)" : "none" }}>
              {before}
              {middle && <span className="accent-text">{middle}</span>}
              {after}
            </motion.div>
          );
        })}
      </motion.div>
    );
  };

  return (
    <div className={cn("font-bold", className)}>
      <div className="mt-4">
        <div className=" dark:text-white text-black text-2xl leading-snug tracking-wide">
          {renderLines()}
        </div>
      </div>
    </div>
  );
};
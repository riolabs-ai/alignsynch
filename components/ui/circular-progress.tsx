"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type * as React from "react";

interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
  valueSize?: number;
  color?: string;
  trailColor?: string;
  animate?: boolean;
}

export function CircularProgress({ value, size = 40, strokeWidth = 4, showValue = false, valueSize = 10, color = "hsl(var(--primary))", trailColor = "hsl(var(--muted))", animate = true, className, ...props }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }} {...props}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Background circle */}
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} stroke={trailColor} fill="none" />
        {/* Progress circle */}
        {animate ? (
          <motion.circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} stroke={color} strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset }} transition={{ duration: 1, ease: "easeOut" }} transform={`rotate(-90 ${size / 2} ${size / 2})`} fill="none" />
        ) : (
          <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} stroke={color} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} transform={`rotate(-90 ${size / 2} ${size / 2})`} fill="none" />
        )}
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center font-medium" style={{ fontSize: valueSize }}>
          {Math.round(value)}%
        </div>
      )}
    </div>
  );
}

import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

export function Logo({
  size = "md",
  showText = true,
  className,
  textClassName,
}: LogoProps) {
  const iconSizes = {
    xs: "h-6 w-6",
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-11 w-11",
    xl: "h-14 w-14",
  };

  const textSizes = {
    xs: "text-xs",
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
    xl: "text-2xl",
  };

  const badgeSizes = {
    xs: "text-[9px] px-1 py-0.2",
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-[11px] px-1.5 py-0.5",
    lg: "text-xs px-2 py-0.5",
    xl: "text-sm px-2.5 py-1",
  };

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <div className={cn("relative shrink-0 flex items-center justify-center", iconSizes[size])}>
        <svg
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full drop-shadow-sm"
        >
          <defs>
            <linearGradient id="shieldGrad" x1="16" y1="8" x2="112" y2="120" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0B132B" />
              <stop offset="100%" stopColor="#030712" />
            </linearGradient>
            <linearGradient id="borderGrad" x1="20" y1="12" x2="108" y2="116" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="50%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#A855F7" />
            </linearGradient>
            <linearGradient id="sparkGradLocal" x1="48" y1="36" x2="80" y2="76" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
          </defs>

          {/* Background container */}
          <rect width="128" height="128" rx="32" fill="url(#shieldGrad)" />
          <rect width="128" height="128" rx="32" stroke="url(#borderGrad)" strokeWidth="3" strokeOpacity="0.4" />

          {/* Shield Outline */}
          <path
            d="M64 18L97 29.5C97 61 84.5 91 64 108C43.5 91 31 61 31 29.5L64 18Z"
            fill="#3B82F6"
            fillOpacity="0.12"
            stroke="url(#borderGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* AI Neural Spark Core */}
          <path
            d="M64 35C64 51 68 55 84 55C68 55 64 59 64 75C64 59 60 55 44 55C60 55 64 51 64 35Z"
            fill="url(#sparkGradLocal)"
          />

          {/* Verification checkmark */}
          <path
            d="M51 72L61 82L79 62"
            stroke="#10B981"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M51 72L61 82L79 62"
            stroke="#A7F3D0"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Satellites */}
          <circle cx="64" cy="28" r="2.5" fill="#38BDF8" />
          <circle cx="89" cy="55" r="2" fill="#818CF8" />
          <circle cx="64" cy="88" r="2" fill="#A78BFA" />
          <circle cx="39" cy="55" r="2" fill="#38BDF8" />
        </svg>
      </div>

      {showText && (
        <div className={cn("flex items-center gap-1.5 leading-none", textClassName)}>
          <span className={cn("font-bold tracking-tight text-foreground", textSizes[size])}>
            Plagi<span className="text-primary">Shield</span>
          </span>
          <span
            className={cn(
              "font-extrabold tracking-wider text-white rounded bg-gradient-to-r from-sky-500 to-indigo-600 shadow-sm",
              badgeSizes[size],
            )}
          >
            AI
          </span>
        </div>
      )}
    </div>
  );
}

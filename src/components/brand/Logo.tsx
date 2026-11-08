import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

export function Logo({ size = "md", showText = true, className, textClassName }: LogoProps) {
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

  return (
    <div className={cn("inline-flex select-none items-center gap-2.5", className)}>
      <div className={cn("flex shrink-0 items-center justify-center", iconSizes[size])}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
        >
          <rect x="1" y="1" width="46" height="46" rx="11" fill="#244C3E" />
          <path
            d="M24 8.5L36 13V23.2C36 31.1 31.3 37.1 24 41C16.7 37.1 12 31.1 12 23.2V13L24 8.5Z"
            stroke="#F7F6F2"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M17.5 24.5L22 29L31 19.5"
            stroke="#D6E5D9"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {showText && (
        <span
          className={cn(
            "font-semibold tracking-[-0.035em] text-foreground",
            textSizes[size],
            textClassName,
          )}
        >
          PlagiShield
        </span>
      )}
    </div>
  );
}

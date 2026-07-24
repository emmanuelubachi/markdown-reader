"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const THEMES = ["light", "dark", "system"] as const;

type Theme = (typeof THEMES)[number];

const THEME_DETAILS: Record<
  Theme,
  {
    icon: typeof Sun;
    label: string;
  }
> = {
  light: { icon: Sun, label: "Light" },
  dark: { icon: Moon, label: "Dark" },
  system: { icon: Monitor, label: "System" },
};

export function ModeToggle() {
  const { setTheme, theme } = useTheme();
  const currentTheme: Theme = THEMES.includes(theme as Theme)
    ? (theme as Theme)
    : "system";
  const currentIndex = THEMES.indexOf(currentTheme);
  const nextTheme = THEMES[(currentIndex + 1) % THEMES.length]!;
  const currentDetails = THEME_DETAILS[currentTheme];
  const nextDetails = THEME_DETAILS[nextTheme];
  const ThemeIcon = currentDetails.icon;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={`${currentDetails.label} theme. Switch to ${nextDetails.label} theme`}
            onClick={() => setTheme(nextTheme)}
            size="icon"
            type="button"
            variant="ghost"
          />
        }
      >
        <ThemeIcon
          aria-hidden="true"
          className="h-[1.2rem] w-[1.2rem] transition-transform duration-200"
        />
      </TooltipTrigger>
      <TooltipContent>
        {currentDetails.label} theme · Next: {nextDetails.label}
      </TooltipContent>
    </Tooltip>
  );
}

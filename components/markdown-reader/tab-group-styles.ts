import type { ReaderTabGroupColor } from "@/lib/markdown/types";

export const TAB_GROUP_COLOR_LABELS: Record<ReaderTabGroupColor, string> = {
  blue: "Blue",
  cyan: "Cyan",
  green: "Green",
  orange: "Orange",
  pink: "Pink",
  purple: "Purple",
};

export const TAB_GROUP_PILL_CLASSES: Record<ReaderTabGroupColor, string> = {
  blue: "border-blue-500/35 bg-blue-500/15 text-blue-800 dark:text-blue-300",
  cyan: "border-cyan-500/35 bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
  green:
    "border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  orange:
    "border-orange-500/35 bg-orange-500/15 text-orange-800 dark:text-orange-300",
  pink: "border-pink-500/35 bg-pink-500/15 text-pink-800 dark:text-pink-300",
  purple:
    "border-purple-500/35 bg-purple-500/15 text-purple-800 dark:text-purple-300",
};

export const TAB_GROUP_DOT_CLASSES: Record<ReaderTabGroupColor, string> = {
  blue: "bg-blue-500",
  cyan: "bg-cyan-500",
  green: "bg-emerald-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  purple: "bg-purple-500",
};

export const TAB_GROUP_TAB_ACCENT_CLASSES: Record<
  ReaderTabGroupColor,
  string
> = {
  blue: "after:bg-blue-500",
  cyan: "after:bg-cyan-500",
  green: "after:bg-emerald-500",
  orange: "after:bg-orange-500",
  pink: "after:bg-pink-500",
  purple: "after:bg-purple-500",
};

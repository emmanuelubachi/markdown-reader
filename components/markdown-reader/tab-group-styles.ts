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
  blue: "border-blue-500/40 bg-blue-500/16 text-blue-800 dark:text-blue-200",
  cyan: "border-cyan-500/40 bg-cyan-500/16 text-cyan-800 dark:text-cyan-200",
  green:
    "border-emerald-500/40 bg-emerald-500/16 text-emerald-800 dark:text-emerald-200",
  orange:
    "border-orange-500/40 bg-orange-500/16 text-orange-800 dark:text-orange-200",
  pink: "border-pink-500/40 bg-pink-500/16 text-pink-800 dark:text-pink-200",
  purple:
    "border-purple-500/40 bg-purple-500/16 text-purple-800 dark:text-purple-200",
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

export const TAB_GROUP_TAB_TINT_CLASSES: Record<
  ReaderTabGroupColor,
  string
> = {
  blue: "bg-blue-500/5 hover:bg-blue-500/10",
  cyan: "bg-cyan-500/5 hover:bg-cyan-500/10",
  green: "bg-emerald-500/5 hover:bg-emerald-500/10",
  orange: "bg-orange-500/5 hover:bg-orange-500/10",
  pink: "bg-pink-500/5 hover:bg-pink-500/10",
  purple: "bg-purple-500/5 hover:bg-purple-500/10",
};

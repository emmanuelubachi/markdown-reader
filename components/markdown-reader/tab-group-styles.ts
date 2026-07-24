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
  blue: "bg-blue-500/16 text-blue-800 dark:text-blue-200",
  cyan: "bg-cyan-500/16 text-cyan-800 dark:text-cyan-200",
  green:
    "bg-emerald-500/16 text-emerald-800 dark:text-emerald-200",
  orange:
    "bg-orange-500/16 text-orange-800 dark:text-orange-200",
  pink: "bg-pink-500/16 text-pink-800 dark:text-pink-200",
  purple:
    "bg-purple-500/16 text-purple-800 dark:text-purple-200",
};

export const TAB_GROUP_DOT_CLASSES: Record<ReaderTabGroupColor, string> = {
  blue: "bg-blue-500",
  cyan: "bg-cyan-500",
  green: "bg-emerald-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  purple: "bg-purple-500",
};

export const TAB_GROUP_ACTIVE_BORDER_CLASSES: Record<
  ReaderTabGroupColor,
  string
> = {
  blue: "border-blue-500/75",
  cyan: "border-cyan-500/75",
  green: "border-emerald-500/75",
  orange: "border-orange-500/75",
  pink: "border-pink-500/75",
  purple: "border-purple-500/75",
};

export const TAB_GROUP_INACTIVE_BORDER_CLASSES: Record<
  ReaderTabGroupColor,
  string
> = {
  blue: "border-b-blue-500/75",
  cyan: "border-b-cyan-500/75",
  green: "border-b-emerald-500/75",
  orange: "border-b-orange-500/75",
  pink: "border-b-pink-500/75",
  purple: "border-b-purple-500/75",
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

"use client";

import { forwardRef } from "react";
import dynamic from "next/dynamic";
import type { MDXEditorMethods } from "@mdxeditor/editor";

import type { InitializedMarkdownEditorProps } from "@/components/markdown-reader/initialized-markdown-editor";

const ClientMarkdownEditor = dynamic(
  () => import("@/components/markdown-reader/initialized-markdown-editor"),
  {
    loading: () => (
      <div
        aria-label="Loading rich Markdown editor"
        className="min-h-80 animate-pulse rounded-lg border border-dashed bg-muted/30"
        role="status"
      />
    ),
    ssr: false,
  },
);

export type RichMarkdownEditorProps = Omit<
  InitializedMarkdownEditorProps,
  "editorRef"
>;

export const RichMarkdownEditor = forwardRef<
  MDXEditorMethods,
  RichMarkdownEditorProps
>((props, ref) => <ClientMarkdownEditor {...props} editorRef={ref} />);

RichMarkdownEditor.displayName = "RichMarkdownEditor";

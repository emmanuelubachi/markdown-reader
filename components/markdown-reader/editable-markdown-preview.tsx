"use client";

import { useEffect, useRef, useState } from "react";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import { Check, PencilLine, TriangleAlert } from "lucide-react";

import { MarkdownPreview } from "@/components/markdown-reader/markdown-preview";
import { RichMarkdownEditor } from "@/components/markdown-reader/rich-markdown-editor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function EditableMarkdownPreview({
  activeSourceLine = null,
  content,
  onActiveHeadingChange,
  onChange,
}: {
  activeSourceLine?: number | null;
  content: string;
  onActiveHeadingChange: (headingId: string) => void;
  onChange: (content: string) => void;
}) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorError, setEditorError] = useState<null | string>(null);

  useEffect(() => {
    if (!isEditing || !editorRef.current) {
      return;
    }

    if (editorRef.current.getMarkdown() !== content) {
      editorRef.current.setMarkdown(content);
    }
  }, [content, isEditing]);

  if (!isEditing) {
    return (
      <div className="relative">
        <div className="mb-4 flex justify-end">
          <Button
            className="gap-1.5"
            onClick={() => {
              setEditorError(null);
              setIsEditing(true);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <PencilLine aria-hidden="true" />
            Edit preview
          </Button>
        </div>
        <MarkdownPreview
          activeSourceLine={activeSourceLine}
          content={content}
          onActiveHeadingChange={onActiveHeadingChange}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">
          Editing rendered Markdown
        </p>
        <Button
          className="gap-1.5"
          onClick={() => setIsEditing(false)}
          size="sm"
          type="button"
        >
          <Check aria-hidden="true" />
          Done
        </Button>
      </div>

      {editorError ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>This document needs Source view</AlertTitle>
          <AlertDescription>
            The rich editor cannot safely represent part of this Markdown. Your
            document is unchanged; use Source view for unsupported HTML or MDX.
          </AlertDescription>
        </Alert>
      ) : null}

      {!editorError ? (
        <RichMarkdownEditor
          markdown={content}
          onChange={(markdown, initialMarkdownNormalize) => {
            if (!initialMarkdownNormalize) {
              onChange(markdown);
            }
          }}
          onError={({ error }) => {
            // MDXEditor can report an import error while its plugin tree is
            // rendering. Defer our state update to avoid a render-phase React
            // update, then unmount the editor so unsupported constructs cannot
            // be normalized away by a later rich-text edit.
            window.setTimeout(() => setEditorError(error), 0);
          }}
          ref={editorRef}
        />
      ) : null}
    </div>
  );
}

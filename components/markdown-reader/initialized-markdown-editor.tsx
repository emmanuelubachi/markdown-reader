"use client";

import type { ForwardedRef, ReactNode } from "react";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ChangeCodeMirrorLanguage,
  CodeToggle,
  ConditionalContents,
  CreateLink,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  StrikeThroughSupSubToggles,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import { useTheme } from "next-themes";

import { sanitizeHref, sanitizeImageSrc } from "@/lib/markdown/sanitize";
import { cn } from "@/lib/utils";

export type InitializedMarkdownEditorProps = {
  editorRef: ForwardedRef<MDXEditorMethods>;
  markdown: string;
  onChange: (markdown: string, initialMarkdownNormalize: boolean) => void;
  onError: (payload: { error: string; source: string }) => void;
};

const BLOCKED_IMAGE_PREVIEW = "/assets/remote-image-blocked.svg";

function ToolbarGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div aria-label={label} className="reader-markdown-toolbar-group" role="group">
      {children}
    </div>
  );
}

export default function InitializedMarkdownEditor({
  editorRef,
  markdown,
  onChange,
  onError,
}: InitializedMarkdownEditorProps) {
  const { resolvedTheme } = useTheme();

  return (
    <MDXEditor
      autoFocus={{ defaultSelection: "rootStart", preventScroll: true }}
      className={cn(
        "reader-markdown-editor",
        resolvedTheme === "dark" && "dark-theme",
      )}
      contentEditableClassName="markdown-preview reader-markdown-content"
      markdown={markdown}
      onChange={onChange}
      onError={onError}
      placeholder="Start writing your document…"
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin({ validateUrl: (url) => sanitizeHref(url) !== null }),
        linkDialogPlugin(),
        tablePlugin(),
        imagePlugin({
          allowSetImageDimensions: false,
          disableImageResize: true,
          disableImageSettingsButton: true,
          imagePreviewHandler: async (source) =>
            sanitizeImageSrc(source) ?? BLOCKED_IMAGE_PREVIEW,
        }),
        codeBlockPlugin({ defaultCodeBlockLanguage: "text" }),
        codeMirrorPlugin({
          autoLoadLanguageSupport: true,
          codeBlockLanguages: {
            bash: "Bash",
            css: "CSS",
            html: "HTML",
            javascript: "JavaScript",
            json: "JSON",
            markdown: "Markdown",
            text: "Plain text",
            tsx: "TypeScript React",
            typescript: "TypeScript",
          },
        }),
        markdownShortcutPlugin(),
        toolbarPlugin({
          toolbarClassName: "reader-markdown-toolbar",
          toolbarContents: () => (
            <ConditionalContents
              options={[
                {
                  when: (editor) => editor?.editorType === "codeblock",
                  contents: () => (
                    <ToolbarGroup label="Code block language">
                      <ChangeCodeMirrorLanguage />
                    </ToolbarGroup>
                  ),
                },
                {
                  fallback: () => (
                    <div className="reader-markdown-toolbar-groups">
                      <ToolbarGroup label="History">
                        <UndoRedo />
                      </ToolbarGroup>

                      <ToolbarGroup label="Text style">
                        <BlockTypeSelect />
                        <BoldItalicUnderlineToggles
                          options={["Bold", "Italic"]}
                        />
                        <CodeToggle />
                        <StrikeThroughSupSubToggles
                          options={["Strikethrough"]}
                        />
                      </ToolbarGroup>

                      <ToolbarGroup label="Lists">
                        <ListsToggle />
                      </ToolbarGroup>

                      <ToolbarGroup label="Insert">
                        <CreateLink />
                        <InsertTable />
                        <InsertCodeBlock />
                        <InsertThematicBreak />
                      </ToolbarGroup>
                    </div>
                  ),
                },
              ]}
            />
          ),
        }),
      ]}
      ref={editorRef}
      spellCheck
      suppressHtmlProcessing
      trim={false}
    />
  );
}

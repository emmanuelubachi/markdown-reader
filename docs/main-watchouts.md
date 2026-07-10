# Markdown Reader Main Watchouts

These are the main implementation watchouts to keep visible as the reader grows.

## Markdown Fidelity

Baseline implemented: read-only preview renders through `react-markdown` with `remark-gfm`, `rehype-raw`, and `rehype-sanitize`; rich editing uses client-only MDXEditor with Markdown-native AST conversion; outline/read-aloud metadata comes from a `unified` + `remark-gfm` AST pass. Unsupported HTML/MDX stays editable through Source view rather than being rendered unsafely in the rich editor. Keep testing against real-world markdown, especially around local image paths, math/diagrams, syntax highlighting, and very large documents.

## Remote Markdown Resources

Remote images are blocked by default to preserve the reader's local-only trust boundary. If remote media support is added later, require an explicit per-document user action and avoid silently loading URLs embedded in untrusted markdown.

## Reader Tab State Complexity

The main reader shell still owns tab mutations directly. If the app adds persistence, tab renaming, recents, saved sessions, split panes, or synced selections, move tab state into a dedicated reducer or hook before the component becomes hard to reason about.

## Read Aloud Lifecycle

Playback must stop whenever its source document is edited, removed, closed, or cleared from the saved session. Keep both desktop and mobile controls wired to the same lifted reader controller.

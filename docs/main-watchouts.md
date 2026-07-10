# Markdown Reader Main Watchouts

These are the main implementation watchouts to keep visible as the reader grows.

## Markdown Fidelity

Baseline implemented: preview now renders through `react-markdown` with `remark-gfm`, `rehype-raw`, and `rehype-sanitize`, while outline/read-aloud metadata comes from a `unified` + `remark-gfm` AST pass. Keep testing against real-world markdown before positioning the app as an "open any markdown" reader, especially around unusual raw HTML, local image paths, math/diagrams, syntax highlighting, and very large documents.

## Remote Markdown Resources

External HTTP(S) images are allowed because the local-only guarantee applies to the Markdown file and document content: the app does not upload or store either on a server. Loading an external image does contact the host referenced by that image directly from the browser, so keep the URL-scheme allowlist in place and never proxy document content through the app server.

## Reader Tab State Complexity

The main reader shell still owns tab mutations directly. If the app adds persistence, tab renaming, recents, saved sessions, split panes, or synced selections, move tab state into a dedicated reducer or hook before the component becomes hard to reason about.

## Read Aloud Lifecycle

Playback must stop whenever its source document is edited, removed, closed, or cleared from the saved session. Keep both desktop and mobile controls wired to the same lifted reader controller.

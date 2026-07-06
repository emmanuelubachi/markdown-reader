# Markdown Reader Main Watchouts

These are the main implementation watchouts to keep visible as the reader grows.

## Markdown Fidelity

Baseline implemented: preview now renders through `react-markdown` with `remark-gfm`, `rehype-raw`, and `rehype-sanitize`, while outline/read-aloud metadata comes from a `unified` + `remark-gfm` AST pass. Keep testing against real-world markdown before positioning the app as an "open any markdown" reader, especially around unusual raw HTML, local image paths, math/diagrams, syntax highlighting, and very large documents.

## Mobile Read Aloud

The read-aloud toolbar is currently optimized for the desktop chrome. Keep the feature reachable on small screens, either through a compact mobile toolbar, a bottom action bar, or a document action menu.

## Reader Tab State Complexity

The main reader shell still owns tab mutations directly. If the app adds persistence, tab renaming, recents, saved sessions, split panes, or synced selections, move tab state into a dedicated reducer or hook before the component becomes hard to reason about.

## Project Documentation

The README still reads like the default Next.js scaffold. Replace it with product-specific setup, feature, architecture, and local-only/privacy notes so future implementation passes have a stable handoff point.

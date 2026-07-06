# Markdown Reader Main Watchouts

These are the main implementation watchouts to keep visible as the reader grows.

## Markdown Fidelity

The current parser is intentionally lightweight. It supports the core preview path, but it is not a full CommonMark pipeline. Before positioning the app as an "open any markdown" reader, improve or replace the parser so it handles nested lists, task lists, escaped table pipes, reference links, footnotes, and richer inline syntax.

## Mobile Read Aloud

The read-aloud toolbar is currently optimized for the desktop chrome. Keep the feature reachable on small screens, either through a compact mobile toolbar, a bottom action bar, or a document action menu.

## Reader Tab State Complexity

The main reader shell still owns tab mutations directly. If the app adds persistence, tab renaming, recents, saved sessions, split panes, or synced selections, move tab state into a dedicated reducer or hook before the component becomes hard to reason about.

## Project Documentation

The README still reads like the default Next.js scaffold. Replace it with product-specific setup, feature, architecture, and local-only/privacy notes so future implementation passes have a stable handoff point.

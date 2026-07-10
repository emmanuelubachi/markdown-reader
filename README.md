<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/assets/logo-mark.svg" />
  <img alt="Markdown Reader logo" src="public/assets/logo-mark-dark.svg" width="88" />
</picture>

<h1>Markdown Reader</h1>

<p>
  A fast, <strong>local-first</strong> markdown reader with a browser-style, full-width interface.<br />
  Open, drop, or paste markdown and read it in a clean, distraction-free preview — files never leave your browser, nothing is uploaded.
</p>

<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img alt="shadcn/ui" src="https://img.shields.io/badge/shadcn/ui-000000?style=for-the-badge&logo=shadcnui&logoColor=white" />
  <img alt="Base UI" src="https://img.shields.io/badge/Base_UI-1A1A1A?style=for-the-badge" />
  <img alt="Turbopack" src="https://img.shields.io/badge/Turbopack-EF4444?style=for-the-badge&logo=turbopack&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white" />
</p>

</div>

## Features

- 🗂️ **Tabbed documents** — open multiple markdown files at once, browser-style.
- 📥 **Multiple inputs** — choose a file, drag & drop anywhere, or paste markdown (dialog or ⌘/Ctrl + V).
- 👀 **Preview & Source** — toggle between the rendered view and the raw markdown.
- 🧭 **Outline navigation** — auto-generated heading outline with active-heading tracking as you scroll.
- 🔊 **Read aloud** — text-to-speech playback with play/pause, stop, and adjustable speed.
- 📊 **Document stats** — live word count, line count, and estimated reading time.
- 🌗 **Light & dark themes** — system-aware with a manual toggle.
- 🔒 **Fully local documents** — parsing, rendering, persistence, and read-aloud generation happen in the browser; document content is never uploaded.

Markdown is rendered with [react-markdown](https://github.com/remarkjs/react-markdown) using [remark-gfm](https://github.com/remarkjs/remark-gfm) for GitHub-flavored markdown (tables, task lists, strikethrough) and [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize) plus custom URL/image sanitization. HTTP(S) images referenced by a document are fetched directly by the browser, while unsafe URL schemes remain blocked. The Markdown file and its content are not uploaded or sent to the app server.

The optional natural read-aloud voice runs on-device after downloading its model on first use. That download does not include document content.

## Tech Stack

| Area       | Technology                                                                     |
| ---------- | ------------------------------------------------------------------------------ |
| Framework  | [Next.js 16](https://nextjs.org) (App Router, Turbopack)                       |
| UI runtime | [React 19](https://react.dev)                                                  |
| Language   | [TypeScript 5](https://www.typescriptlang.org)                                 |
| Styling    | [Tailwind CSS 4](https://tailwindcss.com)                                      |
| Components | [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com)           |
| Markdown   | [react-markdown](https://github.com/remarkjs/react-markdown) · remark · rehype |
| Icons      | [lucide-react](https://lucide.dev)                                             |
| Theming    | [next-themes](https://github.com/pacocoursey/next-themes)                      |
| Package    | [pnpm](https://pnpm.io)                                                        |

## Getting Started

Install dependencies and start the dev server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Scripts

| Command      | Description                  |
| ------------ | ---------------------------- |
| `pnpm dev`   | Start the development server |
| `pnpm build` | Create a production build    |
| `pnpm start` | Run the production build     |
| `pnpm lint`  | Lint the project with ESLint |

## Project Structure

```
app/                          # Next.js App Router entry (layout, page, metadata)
components/
  markdown-reader/            # Feature UI, split by concern
    markdown-reader.tsx       # Container: state, tabs, layout
    reader-tabs.tsx           # Browser-style tab strip
    read-aloud-toolbar.tsx    # Text-to-speech controls
    paste-dialog.tsx          # Paste-markdown dialog
    markdown-preview.tsx      # Rendered markdown output
    outline.tsx               # Heading outline
    file-summary.tsx          # File info + stats
    upload-drop-zone.tsx      # Empty-state / drop target
  ui/                         # shadcn/ui primitives
hooks/
  use-read-aloud.ts           # Speech-synthesis hook
lib/
  markdown/                   # Framework-free logic
    parse.ts                  # Markdown → block model (remark)
    ast.ts                    # AST helpers + heading slugger
    speech, stats, sanitize, document, types
public/assets/                # Brand logo variants (light/dark)
```

## License

Private / internal project.

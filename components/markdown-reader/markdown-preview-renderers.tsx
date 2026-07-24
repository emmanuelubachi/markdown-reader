import {
  Children,
  isValidElement,
  type ComponentPropsWithoutRef,
  type JSX,
  type ReactNode,
} from "react";
import {
  defaultUrlTransform,
  type Components,
  type UrlTransform,
} from "react-markdown";
import {
  defaultSchema,
  type Options as RehypeSanitizeOptions,
} from "rehype-sanitize";

import type { MarkdownAstNode } from "@/lib/markdown/ast";
import { sanitizeHref, sanitizeImageSrc } from "@/lib/markdown/sanitize";

type MarkdownElementProps<Tag extends keyof JSX.IntrinsicElements> =
  ComponentPropsWithoutRef<Tag> & {
    node?: unknown;
  };

export const markdownSanitizeSchema: RehypeSanitizeOptions = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      "alt",
      "title",
      "width",
      "height",
      "loading",
    ],
    input: [...(defaultSchema.attributes?.input ?? []), ["checked", true]],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: [...new Set([...(defaultSchema.protocols?.src ?? []), "data"])],
  },
};

export const markdownComponents: Components = {
  a: MarkdownLink,
  blockquote: MarkdownBlockquote,
  h1: MarkdownH1,
  h2: MarkdownH2,
  h3: MarkdownH3,
  h4: MarkdownH4,
  h5: MarkdownH5,
  h6: MarkdownH6,
  img: MarkdownImage,
  li: MarkdownListItem,
  p: MarkdownParagraph,
  pre: MarkdownPre,
  table: MarkdownTable,
  tr: MarkdownTableRow,
};

export const markdownUrlTransform: UrlTransform = (value, key, _node) => {
  void _node;

  if (key === "href") {
    return sanitizeHref(value);
  }

  if (key === "src") {
    return sanitizeImageSrc(value);
  }

  return defaultUrlTransform(value);
};

function sourceLineOf(node: unknown): number | undefined {
  const line = (node as MarkdownAstNode | undefined)?.position?.start?.line;

  return typeof line === "number" ? line : undefined;
}

function MarkdownLink({
  node: _node,
  href,
  children,
  ...props
}: MarkdownElementProps<"a">) {
  void _node;

  const safeHref = href ? sanitizeHref(href) : null;

  if (!safeHref) {
    return <span>{children}</span>;
  }

  const opensNewWindow = /^(https?:)?\/\//.test(safeHref);

  return (
    <a
      {...props}
      href={safeHref}
      rel={opensNewWindow ? "noreferrer" : props.rel}
      target={opensNewWindow ? "_blank" : props.target}
    >
      {children}
    </a>
  );
}

function MarkdownH1({
  node,
  children,
  ...props
}: MarkdownElementProps<"h1">) {
  return (
    <h1
      {...props}
      data-markdown-heading={shouldTrackHeading(props)}
      data-source-line={sourceLineOf(node)}
    >
      {children}
    </h1>
  );
}

function MarkdownH2({
  node,
  children,
  ...props
}: MarkdownElementProps<"h2">) {
  return (
    <h2
      {...props}
      data-markdown-heading={shouldTrackHeading(props)}
      data-source-line={sourceLineOf(node)}
    >
      {children}
    </h2>
  );
}

function MarkdownH3({
  node,
  children,
  ...props
}: MarkdownElementProps<"h3">) {
  return (
    <h3
      {...props}
      data-markdown-heading={shouldTrackHeading(props)}
      data-source-line={sourceLineOf(node)}
    >
      {children}
    </h3>
  );
}

function MarkdownH4({
  node,
  children,
  ...props
}: MarkdownElementProps<"h4">) {
  return (
    <h4
      {...props}
      data-markdown-heading={shouldTrackHeading(props)}
      data-source-line={sourceLineOf(node)}
    >
      {children}
    </h4>
  );
}

function MarkdownH5({
  node,
  children,
  ...props
}: MarkdownElementProps<"h5">) {
  return (
    <h5
      {...props}
      data-markdown-heading={shouldTrackHeading(props)}
      data-source-line={sourceLineOf(node)}
    >
      {children}
    </h5>
  );
}

function MarkdownH6({
  node,
  children,
  ...props
}: MarkdownElementProps<"h6">) {
  return (
    <h6
      {...props}
      data-markdown-heading={shouldTrackHeading(props)}
      data-source-line={sourceLineOf(node)}
    >
      {children}
    </h6>
  );
}

function MarkdownImage({
  node: _node,
  src,
  alt,
  ...props
}: MarkdownElementProps<"img">) {
  void _node;

  const safeSrc = typeof src === "string" ? sanitizeImageSrc(src) : null;

  if (!safeSrc) {
    return (
      <span className="image-fallback" title="This image URL is not allowed">
        {alt || "Image unavailable"}
      </span>
    );
  }

  // Markdown image dimensions are user-authored, so Next Image cannot know them here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={alt ?? ""} loading="lazy" src={safeSrc} />;
}

function MarkdownParagraph({
  node,
  children,
  className,
  ...props
}: MarkdownElementProps<"p">) {
  const nextClassName = [
    className,
    containsImageChild(children) ? "badge-row" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <p
      {...props}
      className={nextClassName || undefined}
      data-source-line={sourceLineOf(node)}
    >
      {children}
    </p>
  );
}

function MarkdownListItem({
  node,
  children,
  className,
  ...props
}: MarkdownElementProps<"li">) {
  const nextClassName = [
    className,
    containsElementChild(children, "input") ? "task-list-item" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      {...props}
      className={nextClassName || undefined}
      data-source-line={sourceLineOf(node)}
    >
      {children}
    </li>
  );
}

function MarkdownBlockquote({
  node,
  children,
  ...props
}: MarkdownElementProps<"blockquote">) {
  return (
    <blockquote {...props} data-source-line={sourceLineOf(node)}>
      {children}
    </blockquote>
  );
}

function MarkdownTableRow({
  node,
  children,
  ...props
}: MarkdownElementProps<"tr">) {
  return (
    <tr {...props} data-source-line={sourceLineOf(node)}>
      {children}
    </tr>
  );
}

function MarkdownPre({
  node: _node,
  children,
  ...props
}: MarkdownElementProps<"pre">) {
  void _node;

  const language = getCodeBlockLanguage(children);

  return (
    <figure>
      {language ? <figcaption>{language}</figcaption> : null}
      <pre {...props}>{children}</pre>
    </figure>
  );
}

function MarkdownTable({
  node: _node,
  children,
  ...props
}: MarkdownElementProps<"table">) {
  void _node;

  return (
    <div className="table-wrap">
      <table {...props}>{children}</table>
    </div>
  );
}

function getCodeBlockLanguage(children: ReactNode) {
  const codeElement = Children.toArray(children).find((child) =>
    isValidElement<MarkdownElementProps<"code">>(child),
  );

  if (!isValidElement<MarkdownElementProps<"code">>(codeElement)) {
    return null;
  }

  const match = codeElement.props.className?.match(/language-(\S+)/);

  return match?.[1] ?? null;
}

function containsImageChild(children: ReactNode): boolean {
  return containsElementChild(children, "img", MarkdownImage);
}

function containsElementChild(
  children: ReactNode,
  ...elementTypes: Array<"img" | "input" | typeof MarkdownImage>
): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) {
      return false;
    }

    if (elementTypes.includes(child.type as (typeof elementTypes)[number])) {
      return true;
    }

    return containsElementChild(child.props.children, ...elementTypes);
  });
}

function shouldTrackHeading({
  className,
  id,
}: {
  className?: string;
  id?: string;
}) {
  if (!id || id === "user-content-footnote-label") {
    return undefined;
  }

  if (className?.split(" ").includes("sr-only")) {
    return undefined;
  }

  return true;
}

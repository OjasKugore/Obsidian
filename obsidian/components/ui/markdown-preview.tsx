'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  if (!content || !content.trim()) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground italic">
        Nothing to preview yet. Start typing markdown in the editor...
      </div>
    );
  }

  return (
    <div
      className={`prose prose-invert max-w-none text-foreground font-sans leading-relaxed break-words text-sm ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-foreground border-b border-border/60 pb-2 mt-4 mb-3">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-foreground border-b border-border/40 pb-1.5 mt-4 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-foreground mt-3 mb-1.5">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-foreground mt-2 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-3 text-sm text-foreground/90 leading-relaxed">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 space-y-1 text-sm pl-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 space-y-1 text-sm pl-2">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-foreground/90">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/60 bg-muted/30 px-4 py-2 my-3 rounded-r-lg text-muted-foreground italic text-xs">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-xl border border-border/60 bg-background/40">
              <table className="w-full text-xs text-left border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/60 text-foreground uppercase tracking-wider font-semibold border-b border-border/60">
              {children}
            </thead>
          ),
          th: ({ children }) => <th className="px-3 py-2 border-r border-border/40 last:border-r-0">{children}</th>,
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-border/30 border-r border-border/30 last:border-r-0 text-foreground/90">
              {children}
            </td>
          ),
          hr: () => <hr className="my-4 border-border/60" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !String(children).includes('\n');

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-xs text-foreground font-semibold"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <div className="relative my-3 rounded-xl overflow-hidden bg-background border border-border">
                {match && (
                  <div className="bg-muted/60 px-3 py-1 text-[10px] font-mono text-muted-foreground border-b border-border">
                    {match[1]}
                  </div>
                )}
                <pre className="p-3.5 overflow-x-auto font-mono text-xs leading-relaxed text-foreground">
                  <code>{children}</code>
                </pre>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

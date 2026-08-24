'use client';

/**
 * components/ui/CodeViewer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Syntax-highlighted code display with language detection, line numbers,
 * token styling, and one-click copy.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { Copy, Check, Terminal, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CodeViewerProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

export function CodeViewer({
  code,
  language = 'auto',
  showLineNumbers = true,
}: CodeViewerProps) {
  const [copied, setCopied] = React.useState(false);

  const lines = React.useMemo(() => code.split('\n'), [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  // Simple token highlighter for keywords, strings, comments, numbers
  const highlightLine = (line: string): React.ReactNode => {
    // If it's a comment
    if (line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
      return <span className="text-muted-foreground/70 italic">{line}</span>;
    }

    // Highlighting primitives
    const tokens = line.split(/(\s+|[(),;:{}[\]"']|\b(?:const|let|var|function|async|await|return|import|export|from|if|else|switch|case|break|default|for|while|try|catch|throw|class|extends|interface|type|public|private|static|readonly|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|ORDER|BY|GROUP|LIMIT|fn|def|pub|struct|impl|mut|match|enum|package|go|func)\b)/g);

    return tokens.map((token, i) => {
      if (
        /^(const|let|var|function|async|await|return|import|export|from|if|else|switch|case|break|default|for|while|try|catch|throw|class|extends|interface|type|public|private|static|readonly|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|ORDER|BY|GROUP|LIMIT|fn|def|pub|struct|impl|mut|match|enum|package|go|func)$/.test(
          token
        )
      ) {
        return (
          <span key={i} className="text-purple-400 font-bold">
            {token}
          </span>
        );
      }
      if (/^("[^"]*"|'[^']*'|`[^`]*`)$/.test(token)) {
        return (
          <span key={i} className="text-emerald-400">
            {token}
          </span>
        );
      }
      if (/^\d+(\.\d+)?$/.test(token)) {
        return (
          <span key={i} className="text-amber-400">
            {token}
          </span>
        );
      }
      if (/^(true|false|null|undefined|nil|None)$/.test(token)) {
        return (
          <span key={i} className="text-cyan-400 font-semibold">
            {token}
          </span>
        );
      }
      return <span key={i}>{token}</span>;
    });
  };

  return (
    <div className="w-full rounded-xl border border-border/80 bg-background/80 overflow-hidden font-mono text-xs flex flex-col shadow-lg">
      {/* Code Header Bar */}
      <div className="h-9 border-b border-border bg-muted/40 px-4 flex items-center justify-between text-muted-foreground select-none">
        <div className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            {language !== 'auto' ? language : 'Source Code'}
          </span>
          <span className="text-[10px] text-muted-foreground">
            ({lines.length} {lines.length === 1 ? 'line' : 'lines'})
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-bold">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body with Line Numbers */}
      <div className="flex overflow-x-auto p-3 sm:p-4 leading-relaxed">
        {showLineNumbers && (
          <div className="shrink-0 pr-4 mr-3 border-r border-border/60 text-muted-foreground/40 text-right select-none">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        )}
        <pre className="flex-1 text-foreground whitespace-pre overflow-x-auto">
          {lines.map((line, i) => (
            <div key={i} className="min-h-[1.5em]">
              {highlightLine(line)}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

export default CodeViewer;

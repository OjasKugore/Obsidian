'use client';

/**
 * components/header/CliPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Terminal icon in the header that opens a modal explaining the CLI tool.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, Copy, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CliPanel() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [copiedCmd, setCopiedCmd] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <>
      {/* Header button */}
      <button
        id="cli-panel-btn"
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/30 hover:bg-muted hover:border-foreground/40 hover:scale-105 active:scale-95 transition-all duration-150 shadow-sm group cursor-pointer"
        aria-label="Developer CLI"
        title="Developer CLI"
      >
        <Terminal className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.96, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed top-20 right-4 sm:right-8 z-50 w-full max-w-md"
            >
              <div className="bg-card rounded-lg border border-border shadow-2xl overflow-hidden font-mono">
                {/* Modal header */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-muted border border-border text-foreground">
                      <Terminal className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider">Developer CLI</span>
                      <span className="text-[10px] text-muted-foreground">Encrypt from the terminal</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Modal body */}
                <div className="p-5 flex flex-col gap-6">
                  
                  {/* Intro */}
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Obsidian includes a powerful CLI to encrypt and share secrets, files, or entire codebases without leaving your terminal. Perfect for CI/CD pipelines.
                    </p>
                  </div>

                  {/* Commands */}
                  <div className="flex flex-col gap-4">
                    
                    {/* Command 1 */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">1. Send a Paste</span>
                      <div className="group relative rounded-md bg-muted border border-border flex items-center p-2 text-xs text-muted-foreground">
                        <ChevronRight className="h-3.5 w-3.5 text-foreground/50 mr-1.5 shrink-0" />
                        <span className="truncate flex-1">
                          <span className="text-foreground">obsidian send</span> "my secret API key" <span className="text-foreground/60">--burn</span>
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background hover:bg-muted"
                          onClick={() => copyToClipboard('obsidian send "my secret API key" --burn', 'cmd1')}
                        >
                          {copiedCmd === 'cmd1' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>

                    {/* Command 2 */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">2. Read a Paste</span>
                      <div className="group relative rounded-md bg-muted border border-border flex items-center p-2 text-xs text-muted-foreground">
                        <ChevronRight className="h-3.5 w-3.5 text-foreground/50 mr-1.5 shrink-0" />
                        <span className="truncate flex-1">
                          <span className="text-foreground">obsidian read</span> https://obsidian.app/123#key
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background hover:bg-muted"
                          onClick={() => copyToClipboard('obsidian read https://obsidian.app/123#key', 'cmd2')}
                        >
                          {copiedCmd === 'cmd2' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>

                    {/* Command 3 */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">3. Encrypt a whole repo</span>
                      <div className="group relative rounded-md bg-muted border border-border flex items-center p-2 text-xs text-muted-foreground">
                        <ChevronRight className="h-3.5 w-3.5 text-foreground/50 mr-1.5 shrink-0" />
                        <span className="truncate flex-1">
                          <span className="text-foreground">obsidian repo send</span> ./project <span className="text-foreground/60">--exclude</span> dist
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background hover:bg-muted"
                          onClick={() => copyToClipboard('obsidian repo send ./project --exclude dist', 'cmd3')}
                        >
                          {copiedCmd === 'cmd3' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>

                  </div>

                  {/* Footer link */}
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">NPM Package available soon.</span>
                    <a href="https://github.com/your-username/obsidian/tree/main/cli" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-foreground hover:underline transition-all">
                      View CLI Docs →
                    </a>
                  </div>

                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default CliPanel;

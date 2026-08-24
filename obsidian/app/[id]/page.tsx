/**
 * app/[id]/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Decrypted Paste View Route Page.
 * Server component that receives paste ID parameters and renders PasteViewer.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Header } from '@/components/layout/Header';
import { PasteViewer } from '@/components/viewer/PasteViewer';
import { AuroraBackground } from '@/components/ui/AuroraBackground';

export default async function ViewPastePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ── SETUP ──────────────────────────────────────────────────────────────

  // Await async route parameter payload containing paste ID
  const { id } = await params;

  // ── UI ─────────────────────────────────────────────────────────────────

  return (
    <AuroraBackground>
      {/* Navigation Header */}
      <Header />

      {/* Main Decrypted Viewer Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-8 flex flex-col justify-center">
        <PasteViewer pasteId={id} />
      </main>

      {/* Footer Bar */}
      <footer className="w-full border-t border-border py-6 text-xs font-mono text-muted-foreground bg-muted/20 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-[family-name:var(--font-montserrat)] font-black text-xs tracking-tight text-foreground">OBSIDIAN &bull; Client-Side Decrypted View</span>
          <span className="text-[11px] font-mono text-muted-foreground">
            AES-256-GCM &bull; Key Isolated in URL Fragment
          </span>
        </div>
      </footer>
    </AuroraBackground>
  );
}

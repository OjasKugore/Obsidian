import { Header } from '@/components/layout/Header';
import { PasteViewer } from '@/components/viewer/PasteViewer';
import { AuroraBackground } from '@/components/ui/AuroraBackground';

export default async function ViewPastePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AuroraBackground>
      {/* Navigation Header */}
      <Header />

      {/* Main Decrypted Viewer Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-8 flex flex-col justify-center">
        <PasteViewer pasteId={id} />
      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-border/20 py-5 text-center text-xs text-muted-foreground/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-girard tracking-wide text-foreground/90">Obsidian &bull; Client-Side Decrypted View</span>
          <span className="text-[11px] font-mono text-muted-foreground/70">
            AES-256-GCM &bull; Key Isolated in URL Fragment
          </span>
        </div>
      </footer>
    </AuroraBackground>
  );
}

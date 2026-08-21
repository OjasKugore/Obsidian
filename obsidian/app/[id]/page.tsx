import { Header } from '@/components/layout/Header';
import { PasteViewer } from '@/components/viewer/PasteViewer';

export default async function ViewPastePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Dynamic Background Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-blue-600/10 via-indigo-600/5 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 -left-48 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/2 -right-48 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Navigation Header */}
      <Header />

      {/* Main Decrypted Viewer Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col justify-center">
        <PasteViewer pasteId={id} />
      </main>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-border/30 py-6 text-center text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Obsidian &bull; Client-Side Decrypted View</span>
          <span className="text-[11px]">
            AES-256-GCM &bull; Key Isolated in URL Fragment
          </span>
        </div>
      </footer>
    </div>
  );
}

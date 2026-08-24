import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
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

      {/* Universal Footer */}
      <Footer />
    </AuroraBackground>
  );
}

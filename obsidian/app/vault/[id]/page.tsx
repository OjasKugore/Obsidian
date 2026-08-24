import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { VaultManager } from '@/components/vault/VaultManager';
import { AuroraBackground } from '@/components/ui/AuroraBackground';

export const metadata = {
  title: 'Decrypted Vault | Obsidian',
  description: 'Client-side decrypted multi-secret collection.',
};

export default async function ViewVaultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AuroraBackground>
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 flex flex-col gap-6">
        <VaultManager initialPasteId={id} />
      </main>
      <Footer />
    </AuroraBackground>
  );
}

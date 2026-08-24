import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { VaultManager } from '@/components/vault/VaultManager';
import { AuroraBackground } from '@/components/ui/AuroraBackground';

export const metadata = {
  title: 'Encrypted Vault | Obsidian',
  description: 'Manage and store multi-secret encrypted collections with zero-knowledge AES-256-GCM encryption.',
};

export default function VaultPage() {
  return (
    <AuroraBackground>
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 flex flex-col gap-6">
        <VaultManager />
      </main>
      <Footer />
    </AuroraBackground>
  );
}

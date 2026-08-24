'use client';

/**
 * components/vault/VaultManager.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Encrypted Paste Vault Interface.
 *
 * Supports all 3 zero-knowledge delivery tiers:
 *   1. Symmetric (Direct URL hash #key or Master Password)
 *   2. Asymmetric RSA-OAEP (Targeted delivery with #asym URL)
 *   3. Shamir's Secret Sharing (Multi-party K-of-N threshold quorum)
 *
 * Strict monochrome styling matching Obsidian design standards.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Key,
  Shield,
  Copy,
  Check,
  Download,
  FileText,
  Search,
  Tag,
  ArrowLeft,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Users,
  Layers,
  KeyRound,
  QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CodeViewer } from '@/components/ui/CodeViewer';
import { MarkdownPreview } from '@/components/ui/markdown-preview';
import { RecipientKeyInput } from '@/components/editor/RecipientKeyInput';
import { PrivateKeyUnlock } from '@/components/viewer/PrivateKeyUnlock';
import { ShardQuorumPanel } from '@/components/viewer/ShardQuorumPanel';
import {
  VaultItem,
  EncryptedVaultManifest,
  encryptVault,
  decryptVault,
} from '@/lib/crypto/vault';
import { loadIdentityKey } from '@/lib/crypto/keystore';
import { unwrapAESKey } from '@/lib/crypto/asymmetric';
import { combineShards, parseShard } from '@/lib/crypto/shamir';
import type { CreatePasteResponse, GetPasteResponse } from '@/lib/api/schemas';

interface VaultManagerProps {
  initialPasteId?: string;
  initialKey?: string;
}

export function VaultManager({ initialPasteId, initialKey }: VaultManagerProps) {
  // Vault state
  const [vaultTitle, setVaultTitle] = React.useState('My Confidential Vault');
  const [vaultDescription, setVaultDescription] = React.useState('Multi-secret encrypted bundle');
  const [items, setItems] = React.useState<VaultItem[]>([
    {
      id: 'item-1',
      title: 'Database Credentials',
      content: 'DATABASE_URL="postgres://admin:secret123@neondb.tech/main?sslmode=require"\nREDIS_URL="rediss://default:token@upstash.io:6379"',
      formatter: 'syntaxhighlighting',
      tags: ['database', 'production'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'item-2',
      title: 'Infrastructure Runbook',
      content: '# Infrastructure Access Guide\n- Bastion: 10.0.0.1\n- VPC: vpc-0a1b2c3d\n- Admin team: @secops',
      formatter: 'markdown',
      tags: ['devops', 'infra'],
      createdAt: new Date().toISOString(),
    },
  ]);

  // Selected item
  const [selectedItemId, setSelectedItemId] = React.useState<string>('item-1');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Delivery configuration state
  const [deliveryMode, setDeliveryMode] = React.useState<'symmetric' | 'asymmetric' | 'shamir'>('symmetric');
  const [recipientPublicKey, setRecipientPublicKey] = React.useState('');
  const [validRecipientKey, setValidRecipientKey] = React.useState<string | null>(null);
  const [shamirThreshold, setShamirThreshold] = React.useState(2);
  const [shamirShares, setShamirShares] = React.useState(3);

  // Password & Unlock state
  const [masterPassword, setMasterPassword] = React.useState('');
  const [isLocked, setIsLocked] = React.useState(Boolean(initialPasteId));
  const [isLoading, setIsLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [vaultShareUrl, setVaultShareUrl] = React.useState<string | null>(null);
  const [generatedShardUrls, setGeneratedShardUrls] = React.useState<Array<{ index: number; url: string }> | null>(null);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [copiedAll, setCopiedAll] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Asymmetric and Shamir unlock states
  const [isAwaitingPrivateKey, setIsAwaitingPrivateKey] = React.useState(false);
  const [isAsymmetricMode, setIsAsymmetricMode] = React.useState(false);
  const [isShamirMode, setIsShamirMode] = React.useState(false);
  const [quorumThreshold, setQuorumThreshold] = React.useState(2);
  const [quorumTotalShards, setQuorumTotalShards] = React.useState(3);
  const [loadedShards, setLoadedShards] = React.useState<Array<{ index: number; shardString: string }>>([]);
  const [rawPasteData, setRawPasteData] = React.useState<GetPasteResponse | null>(null);

  // New item drafting
  const [newItemTitle, setNewItemTitle] = React.useState('');
  const [newItemContent, setNewItemContent] = React.useState('');
  const [newItemFormatter, setNewItemFormatter] = React.useState<'plaintext' | 'markdown' | 'syntaxhighlighting'>('plaintext');
  const [newItemTags, setNewItemTags] = React.useState('');
  const [isAddingItem, setIsAddingItem] = React.useState(false);

  // ── Load and decrypt if initialPasteId provided ───────────────────────────
  React.useEffect(() => {
    async function loadExistingVault() {
      if (!initialPasteId) return;
      setIsLoading(true);
      setStatusMessage(null);

      try {
        const res = await fetch(`/api/v1/paste/${initialPasteId}`);
        if (!res.ok) throw new Error('Vault not found or expired.');
        const pasteData: GetPasteResponse = await res.json();
        setRawPasteData(pasteData);

        const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
        const keyToUse = hash || initialKey || '';

        // Check if Asymmetric
        if (keyToUse === 'asym' || pasteData.adata[4]) {
          setIsAsymmetricMode(true);
          const identityKeyRecord = await loadIdentityKey();
          if (identityKeyRecord?.privateKey && pasteData.adata[4]) {
            try {
              const rawKey = await unwrapAESKey(
                pasteData.adata[4] as string,
                identityKeyRecord.privateKey
              );
              const manifest = await decryptVault(pasteData.ct, pasteData.adata, rawKey);
              setVaultTitle(manifest.vaultTitle);
              setVaultDescription(manifest.description || '');
              setItems(manifest.items);
              if (manifest.items.length > 0) setSelectedItemId(manifest.items[0].id);
              setIsLocked(false);
              setIsLoading(false);
              return;
            } catch {
              // Fallback to manual private key unlock prompt
            }
          }
          setIsAwaitingPrivateKey(true);
          setIsLocked(true);
          setIsLoading(false);
          return;
        }

        // Check if Shamir shard in URL
        if (keyToUse.startsWith('shard-')) {
          setIsShamirMode(true);
          const parsed = parseShard(keyToUse);
          if (parsed) {
            setQuorumThreshold(parsed.threshold);
            setQuorumTotalShards(parsed.total || 3);
            setLoadedShards([{ index: parsed.index, shardString: keyToUse }]);
          }
          setIsLocked(true);
          setIsLoading(false);
          return;
        }

        // Standard Symmetric
        if (!keyToUse) {
          setIsLocked(true);
          setIsLoading(false);
          return;
        }

        const manifest = await decryptVault(pasteData.ct, pasteData.adata, keyToUse);
        setVaultTitle(manifest.vaultTitle);
        setVaultDescription(manifest.description || '');
        setItems(manifest.items);
        if (manifest.items.length > 0) {
          setSelectedItemId(manifest.items[0].id);
        }
        setIsLocked(false);
      } catch (err: unknown) {
        setStatusMessage(err instanceof Error ? err.message : 'Failed to decrypt vault.');
        setIsLocked(true);
      } finally {
        setIsLoading(false);
      }
    }

    loadExistingVault();
  }, [initialPasteId, initialKey]);

  // ── Unlock Handlers ───────────────────────────────────────────────────────

  const handleUnlockWithPassword = async () => {
    if (!initialPasteId || !masterPassword.trim()) return;
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/v1/paste/${initialPasteId}`);
      if (!res.ok) throw new Error('Vault not found.');
      const pasteData: GetPasteResponse = await res.json();
      const manifest = await decryptVault(pasteData.ct, pasteData.adata, masterPassword.trim());
      setVaultTitle(manifest.vaultTitle);
      setVaultDescription(manifest.description || '');
      setItems(manifest.items);
      if (manifest.items.length > 0) setSelectedItemId(manifest.items[0].id);
      setIsLocked(false);
    } catch (err: unknown) {
      setStatusMessage('Incorrect master password or corrupted vault.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecryptWithPrivateKey = async (privKey: CryptoKey) => {
    if (!rawPasteData || !rawPasteData.adata[4]) {
      throw new Error('No wrapped key found on vault payload.');
    }
    setIsLoading(true);
    try {
      const rawKey = await unwrapAESKey(
        rawPasteData.adata[4] as string,
        privKey
      );
      const manifest = await decryptVault(rawPasteData.ct, rawPasteData.adata, rawKey);
      setVaultTitle(manifest.vaultTitle);
      setVaultDescription(manifest.description || '');
      setItems(manifest.items);
      if (manifest.items.length > 0) setSelectedItemId(manifest.items[0].id);
      setIsLocked(false);
      setIsAwaitingPrivateKey(false);
    } catch (err: unknown) {
      throw new Error('Private key failed to unwrap this vault. Key mismatch.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddQuorumShard = async (shardInput: string) => {
    if (!rawPasteData) return { success: false, error: 'Vault data not loaded.' };
    try {
      const parsed = parseShard(shardInput.trim());
      if (!parsed) {
        return { success: false, error: 'Invalid shard token format.' };
      }
      if (loadedShards.some((s) => s.index === parsed.index)) {
        return { success: false, error: `Shard #${parsed.index} is already loaded.` };
      }

      const updated = [...loadedShards, { index: parsed.index, shardString: shardInput.trim() }];
      setLoadedShards(updated);

      // Check if threshold satisfied
      if (updated.length >= quorumThreshold) {
        setIsLoading(true);
        const rawKey = combineShards(updated.map((s) => s.shardString));
        const manifest = await decryptVault(rawPasteData.ct, rawPasteData.adata, rawKey);
        setVaultTitle(manifest.vaultTitle);
        setVaultDescription(manifest.description || '');
        setItems(manifest.items);
        if (manifest.items.length > 0) setSelectedItemId(manifest.items[0].id);
        setIsLocked(false);
        setIsLoading(false);
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Invalid shard string.' };
    }
  };

  // ── Save & Encrypt Vault ──────────────────────────────────────────────────

  const handleSaveAndEncryptVault = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const manifest: EncryptedVaultManifest = {
        version: 1,
        vaultTitle,
        description: vaultDescription,
        items,
        updatedAt: new Date().toISOString(),
      };

      const encPkg = await encryptVault(manifest, {
        mode: deliveryMode,
        recipientPublicKey: validRecipientKey || undefined,
        shamirThreshold,
        shamirShares,
      });

      const res = await fetch('/api/v1/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          v: 2,
          ct: encPkg.ciphertext,
          adata: encPkg.adata,
          meta: {
            expire: 'never',
            burnAfterReading: false,
            openDiscussion: false,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to save vault on server.');
      const data: CreatePasteResponse = await res.json();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';

      if (encPkg.isAsymmetric) {
        setVaultShareUrl(`${origin}/vault/${data.pasteId}#asym`);
        setGeneratedShardUrls(null);
      } else if (encPkg.isShamir && encPkg.shards) {
        const shardList = encPkg.shards.map((shardStr, idx) => ({
          index: idx + 1,
          url: `${origin}/vault/${data.pasteId}#${shardStr}`,
        }));
        setGeneratedShardUrls(shardList);
        setVaultShareUrl(`${origin}/vault/${data.pasteId}#${encPkg.shards[0]}`);
      } else {
        const url = `${origin}/vault/${data.pasteId}#${encPkg.keyBase58}`;
        setVaultShareUrl(url);
        setGeneratedShardUrls(null);
      }
    } catch (err: unknown) {
      setStatusMessage(err instanceof Error ? err.message : 'Encryption failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!newItemTitle.trim() || !newItemContent.trim()) return;
    const newItem: VaultItem = {
      id: `item-${Date.now()}`,
      title: newItemTitle.trim(),
      content: newItemContent,
      formatter: newItemFormatter,
      tags: newItemTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      createdAt: new Date().toISOString(),
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedItemId(newItem.id);
    setNewItemTitle('');
    setNewItemContent('');
    setNewItemTags('');
    setIsAddingItem(false);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (selectedItemId === id) {
      const remaining = items.filter((it) => it.id !== id);
      if (remaining.length > 0) setSelectedItemId(remaining[0].id);
    }
  };

  const filteredItems = items.filter(
    (it) =>
      it.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeItem = items.find((it) => it.id === selectedItemId);

  // ── Render Locked Viewers ─────────────────────────────────────────────────

  if (isLocked) {
    if (isAwaitingPrivateKey) {
      return (
        <div className="w-full max-w-xl mx-auto my-8">
          <PrivateKeyUnlock onUnlock={handleDecryptWithPrivateKey} />
        </div>
      );
    }

    if (isShamirMode) {
      return (
        <div className="w-full max-w-xl mx-auto my-8">
          <ShardQuorumPanel
            threshold={quorumThreshold}
            totalShards={quorumTotalShards}
            loadedShards={loadedShards}
            onAddShard={handleAddQuorumShard}
            isDecrypting={isLoading}
            error={statusMessage}
          />
        </div>
      );
    }

    return (
      <div className="w-full max-w-md mx-auto my-12 p-6 sm:p-8 rounded-2xl border border-border bg-card shadow-2xl flex flex-col gap-5 font-mono text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border text-foreground mx-auto shadow-sm">
          <Lock className="h-6 w-6 text-foreground" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground">Encrypted Vault Locked</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Provide the master password or complete link with key fragment.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="Enter Master Password..."
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlockWithPassword()}
            className="w-full h-10 px-3 rounded-lg bg-background border border-border text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/50"
          />

          <Button
            onClick={handleUnlockWithPassword}
            disabled={isLoading || !masterPassword.trim()}
            className="h-10 font-bold text-xs bg-foreground text-background"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unlock Vault'}
          </Button>

          {statusMessage && (
            <p className="text-xs text-destructive mt-1">{statusMessage}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Render Active Vault Manager ───────────────────────────────────────────

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 font-mono">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background shadow-md">
            <Database className="h-5 w-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={vaultTitle}
                onChange={(e) => setVaultTitle(e.target.value)}
                className="text-lg sm:text-xl font-bold tracking-tight bg-transparent text-foreground border-b border-transparent hover:border-border focus:border-foreground focus:outline-none px-1"
              />
            </div>
            <input
              type="text"
              value={vaultDescription}
              onChange={(e) => setVaultDescription(e.target.value)}
              placeholder="Vault description..."
              className="text-xs text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-foreground focus:outline-none px-1 w-full max-w-sm mt-0.5"
            />
          </div>
        </div>

        {/* Save & Encrypt Action */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSaveAndEncryptVault}
            disabled={isLoading || items.length === 0}
            className="gap-1.5 text-xs font-bold bg-foreground text-background h-9 rounded-lg shadow-md"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            <span>Encrypt &amp; Save Vault</span>
          </Button>
        </div>
      </div>

      {/* Share Links Banner if saved */}
      {vaultShareUrl && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              <span>Vault Encrypted &amp; Published</span>
            </span>
            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
              Zero-Knowledge Package
            </Badge>
          </div>

          {/* If Shamir Shards */}
          {generatedShardUrls ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Distribute these {generatedShardUrls.length} custody shards (Threshold: {shamirThreshold}-of-{shamirShares}):</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedShardUrls.map((s) => `Shard #${s.index}: ${s.url}`).join('\n\n'));
                    setCopiedAll(true);
                    setTimeout(() => setCopiedAll(false), 2000);
                  }}
                  className="h-6 text-[10px] font-mono"
                >
                  {copiedAll ? 'Copied All Links' : 'Copy All Shards'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {generatedShardUrls.map((s, idx) => (
                  <div key={s.index} className="flex items-center justify-between p-2 rounded bg-background border border-border text-xs">
                    <span className="font-bold text-foreground">Shard #{s.index}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(s.url);
                        setCopiedIndex(idx);
                        setTimeout(() => setCopiedIndex(null), 2000);
                      }}
                      className="h-6 text-[10px] gap-1"
                    >
                      {copiedIndex === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={vaultShareUrl}
                className="w-full h-8 px-2.5 rounded bg-background border border-border text-xs text-foreground font-mono"
              />
              <Button
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(vaultShareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="h-8 text-xs font-mono shrink-0 bg-foreground text-background"
              >
                {copied ? 'Copied' : 'Copy URL'}
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {/* Delivery Mode Selector Bar */}
      <div className="p-3.5 rounded-xl border border-border bg-card/60 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Vault Delivery Mode
          </span>
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-background border border-border text-xs">
            <button
              type="button"
              onClick={() => setDeliveryMode('symmetric')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all cursor-pointer ${
                deliveryMode === 'symmetric'
                  ? 'bg-muted text-foreground font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Key className="h-3.5 w-3.5" />
              <span>Symmetric (#key)</span>
            </button>
            <button
              type="button"
              onClick={() => setDeliveryMode('asymmetric')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all cursor-pointer ${
                deliveryMode === 'asymmetric'
                  ? 'bg-muted text-foreground font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>RSA-OAEP Public Key</span>
            </button>
            <button
              type="button"
              onClick={() => setDeliveryMode('shamir')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all cursor-pointer ${
                deliveryMode === 'shamir'
                  ? 'bg-muted text-foreground font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Shamir SSS (K-of-N)</span>
            </button>
          </div>
        </div>

        {/* Asymmetric Key Configuration */}
        {deliveryMode === 'asymmetric' && (
          <div className="pt-2 border-t border-border/60">
            <RecipientKeyInput
              value={recipientPublicKey}
              onChange={setRecipientPublicKey}
              onKeyChange={setValidRecipientKey}
            />
          </div>
        )}

        {/* Shamir SSS Configuration */}
        {deliveryMode === 'shamir' && (
          <div className="pt-2 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-background border border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Threshold (K):</span>
                <span className="text-foreground font-bold">{shamirThreshold} Shards</span>
              </div>
              <input
                type="range"
                min={2}
                max={10}
                value={shamirThreshold}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setShamirThreshold(val);
                  if (val > shamirShares) setShamirShares(val);
                }}
                className="w-full h-1.5 bg-muted rounded appearance-none cursor-pointer accent-foreground"
              />
            </div>
            <div className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-background border border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Shares (N):</span>
                <span className="text-foreground font-bold">{shamirShares} Shards</span>
              </div>
              <input
                type="range"
                min={2}
                max={10}
                value={shamirShares}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setShamirShares(val);
                  if (val < shamirThreshold) setShamirThreshold(val);
                }}
                className="w-full h-1.5 bg-muted rounded appearance-none cursor-pointer accent-foreground"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Workspace: Sidebar Items List + Active Item Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Secret Items List */}
        <div className="lg:col-span-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Vault Items ({items.length})
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAddingItem(true)}
              className="h-7 text-xs font-mono gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Item</span>
            </Button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search secrets or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/50"
            />
          </div>

          {/* Items List */}
          <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 text-center">No secret items found.</p>
            ) : (
              filteredItems.map((it) => (
                <div
                  key={it.id}
                  onClick={() => {
                    setSelectedItemId(it.id);
                    setIsAddingItem(false);
                  }}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                    selectedItemId === it.id && !isAddingItem
                      ? 'bg-muted/80 border-foreground/50 font-bold text-foreground shadow-sm'
                      : 'bg-background/60 border-border/70 text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                >
                  <div className="flex flex-col gap-0.5 truncate">
                    <span className="truncate">{it.title}</span>
                    <div className="flex items-center gap-1">
                      {it.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[9px] px-1 py-0.2 rounded bg-muted/60 text-muted-foreground">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(it.id);
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Item Viewer / Editor */}
        <div className="lg:col-span-8 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm min-h-[460px]">
          {isAddingItem ? (
            /* Add Item Form */
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">Add New Secret Item</h3>
                <Button size="sm" variant="ghost" onClick={() => setIsAddingItem(false)} className="h-7 text-xs">
                  Cancel
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Item Title (e.g. AWS Production Credentials)..."
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="w-full h-9 px-3 rounded bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:border-foreground/50"
                />

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Format:</span>
                  <div className="flex items-center gap-1 bg-background p-0.5 rounded border border-border text-xs">
                    {(['plaintext', 'markdown', 'syntaxhighlighting'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setNewItemFormatter(fmt)}
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                          newItemFormatter === fmt ? 'bg-muted text-foreground font-bold' : 'text-muted-foreground'
                        }`}
                      >
                        {fmt === 'syntaxhighlighting' ? 'Code' : fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  placeholder="Paste confidential credentials, code, or markdown runbook..."
                  value={newItemContent}
                  onChange={(e) => setNewItemContent(e.target.value)}
                  rows={8}
                  className="w-full p-3 rounded bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:border-foreground/50 leading-relaxed resize-y"
                />

                <input
                  type="text"
                  placeholder="Tags comma separated (e.g. k8s, production, devops)..."
                  value={newItemTags}
                  onChange={(e) => setNewItemTags(e.target.value)}
                  className="w-full h-9 px-3 rounded bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:border-foreground/50"
                />

                <Button onClick={handleAddItem} className="h-9 font-bold text-xs bg-foreground text-background">
                  Save Item to Vault
                </Button>
              </div>
            </div>
          ) : activeItem ? (
            /* Active Item Viewer */
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-bold text-foreground">{activeItem.title}</h3>
                  <div className="flex items-center gap-1.5">
                    {activeItem.tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0 border-border">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(activeItem.content);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="h-8 text-xs font-mono gap-1"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Secret'}</span>
                  </Button>
                </div>
              </div>

              {/* Secret Content View */}
              {activeItem.formatter === 'markdown' ? (
                <div className="p-4 rounded-lg bg-background/50 border border-border overflow-x-auto min-h-[160px]">
                  <MarkdownPreview content={activeItem.content} />
                </div>
              ) : activeItem.formatter === 'syntaxhighlighting' ? (
                <CodeViewer code={activeItem.content} />
              ) : (
                <div className="p-4 rounded-lg bg-background/50 border border-border overflow-x-auto min-h-[160px]">
                  <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-words">
                    {activeItem.content}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center m-auto text-muted-foreground text-xs gap-2">
              <FileText className="h-8 w-8" />
              <span>Select or create a secret item from the left sidebar.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VaultManager;

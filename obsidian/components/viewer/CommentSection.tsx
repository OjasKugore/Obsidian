'use client';

/**
 * components/viewer/CommentSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * End-to-end encrypted comment thread for open discussion pastes.
 * Encrypts and decrypts comments client-side using the shared paste URL key.
 * Strict monochrome styling matching Obsidian design standards.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Lock,
  Send,
  Loader2,
  ShieldCheck,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { encrypt, decrypt } from '@/lib/crypto/cipher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Comment, CreateCommentBody } from '@/lib/api/schemas';

interface DecryptedComment {
  id: string;
  plaintext: string;
  icon: string | null;
  createdAt: string;
}

interface CommentSectionProps {
  pasteId: string;
  rawKey: Uint8Array;
}

const AVATAR_ICONS = ['💬', '🔒', '⚡', '💡', '🛡️', '🚀', '🤖', '🐱'];

export function CommentSection({ pasteId, rawKey }: CommentSectionProps) {
  // ── SETUP ──────────────────────────────────────────────────────────────

  // List of client-side decrypted comments
  const [comments, setComments] = React.useState<DecryptedComment[]>([]);
  
  // Loading and submitting status flags
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Error message state
  const [error, setError] = React.useState<string | null>(null);
  
  // New comment text input state
  const [content, setContent] = React.useState('');
  
  // Selected avatar icon emoji
  const [selectedIcon, setSelectedIcon] = React.useState('💬');

  // Fetches encrypted comments from backend API and decrypts them client-side using rawKey
  React.useEffect(() => {
    if (!pasteId || !rawKey) return;
    let cancelled = false;

    const loadComments = async () => {
      try {
        const res = await fetch(`/api/v1/paste/${pasteId}/comment`);
        if (!res.ok) {
          if (res.status === 403 || res.status === 404) {
            if (!cancelled) setIsLoading(false);
            return;
          }
          throw new Error('Failed to fetch discussion comments');
        }

        const data: Comment[] = await res.json();

        // Decrypt each comment client-side using the URL key
        const decryptedList: DecryptedComment[] = [];
        for (const item of data) {
          try {
            const decrypted = await decrypt(item.ct, item.adata, rawKey);
            decryptedList.push({
              id: item.id,
              plaintext: decrypted,
              icon: item.icon,
              createdAt: item.createdAt,
            });
          } catch (decErr) {
            console.warn('Could not decrypt comment:', decErr);
            decryptedList.push({
              id: item.id,
              plaintext: '[Encrypted comment could not be decrypted]',
              icon: item.icon,
              createdAt: item.createdAt,
            });
          }
        }

        if (!cancelled) {
          setComments(decryptedList);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Error loading comments';
          setError(msg);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [pasteId, rawKey]);

  // ── ACTIONS ────────────────────────────────────────────────────────────

  // Encrypts new comment text client-side with AES-256-GCM and POSTs payload to API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      // Encrypt comment body using the shared paste key
      const encResult = await encrypt(content, 'plaintext', {
        burnAfterReading: false,
        openDiscussion: true,
        customKey: rawKey,
      });

      const payload: CreateCommentBody = {
        v: 2,
        ct: encResult.ciphertext,
        adata: encResult.adata,
        parentId: '',
        icon: selectedIcon,
      };

      const res = await fetch(`/api/v1/paste/${pasteId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to post comment');
      }

      const created: Comment = await res.json();

      // Append new decrypted comment locally
      setComments((prev) => [
        ...prev,
        {
          id: created.id,
          plaintext: content,
          icon: created.icon,
          createdAt: created.createdAt,
        },
      ]);

      setContent('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to post reply';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full flex flex-col gap-6 mt-4 font-mono">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-foreground" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Encrypted Discussion
          </h3>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {comments.length} {comments.length === 1 ? 'reply' : 'replies'}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-foreground" />
          <span>E2EE Comments</span>
        </div>
      </div>

      {/* Comment Posting Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-border bg-card p-4 sm:p-5 flex flex-col gap-3 shadow-lg transition-all"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-foreground" /> Choose your avatar:
          </span>

          {/* Avatar Emoji Selector */}
          <div className="flex items-center gap-1 bg-background p-1 rounded border border-border">
            {AVATAR_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setSelectedIcon(icon)}
                className={`h-6 w-6 flex items-center justify-center rounded text-xs transition-all ${
                  selectedIcon === icon
                    ? 'bg-muted border border-border shadow-sm'
                    : 'opacity-50 hover:opacity-100'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Comment Textarea Input */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Leave an encrypted response... Only holders of this link can decrypt and read it."
          rows={3}
          required
          className="w-full bg-background rounded border border-border p-3 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/50 resize-y min-h-[80px]"
        />

        {/* Form Action Row */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            Encrypted client-side with AES-256-GCM
          </span>

          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() || isSubmitting}
            className="gap-1.5 font-bold font-mono text-xs px-4 h-8 bg-foreground text-background hover:opacity-90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Encrypting...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Post Reply</span>
              </>
            )}
          </Button>
        </div>

        {/* Error Alert Display */}
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded bg-destructive/10 border border-destructive/25 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Decrypted Comments Thread List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8 gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-foreground" />
          <span>Decrypting discussion thread…</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg p-6">
          No encrypted replies yet. Start the conversation above!
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {comments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{comment.icon || '💬'}</span>
                    <span className="text-[11px] font-bold text-foreground">Anonymous Peer</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap pl-6">
                  {comment.plaintext}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default CommentSection;

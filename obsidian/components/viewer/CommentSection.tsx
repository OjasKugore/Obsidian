'use client';

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
  const [comments, setComments] = React.useState<DecryptedComment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [content, setContent] = React.useState('');
  const [selectedIcon, setSelectedIcon] = React.useState('💬');

  // 1. Fetch & Decrypt existing comments
  const fetchComments = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch(`/api/v1/paste/${pasteId}/comment`);
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) return;
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

      setComments(decryptedList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading comments';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [pasteId, rawKey]);

  React.useEffect(() => {
    if (pasteId && rawKey) {
      fetchComments();
    }
  }, [pasteId, rawKey, fetchComments]);

  // 2. Submit new encrypted comment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError(null);

      // Encrypt comment body using the same cipher with direct symmetric mode
      const encResult = await encrypt(content, 'plaintext', {
        burnAfterReading: false,
        openDiscussion: true,
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

  return (
    <div className="w-full flex flex-col gap-6 mt-4">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-400" />
          <h3 className="text-base font-bold text-foreground">
            Encrypted Discussion
          </h3>
          <Badge variant="outline" className="text-xs px-2 py-0">
            {comments.length} {comments.length === 1 ? 'reply' : 'replies'}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>E2EE Comments</span>
        </div>
      </div>

      {/* Comment Posting Form */}
      <form
        onSubmit={handleSubmit}
        className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-3 border border-border/60 focus-within:border-primary/50 transition-all"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-blue-400" /> Choose your anonymous avatar:
          </span>

          {/* Avatar Icon Selector */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/40">
            {AVATAR_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setSelectedIcon(icon)}
                className={`h-7 w-7 flex items-center justify-center rounded-lg text-sm transition-all ${
                  selectedIcon === icon
                    ? 'bg-background shadow-sm scale-110'
                    : 'opacity-60 hover:opacity-100 hover:scale-105'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* Text Input */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Leave an encrypted response or feedback... Only holders of this link can decrypt and read it."
          rows={3}
          required
          className="w-full bg-background/60 rounded-xl border border-border/60 p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y min-h-[80px]"
        />

        {/* Submit Action */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted-foreground">
            Encrypted client-side with AES-256-GCM
          </span>

          <Button
            type="submit"
            size="sm"
            variant="glow"
            disabled={!content.trim() || isSubmitting}
            className="gap-1.5 font-semibold px-4"
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

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Comments List */}
      <div className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex items-center justify-center p-8 text-xs text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Decrypting thread replies...</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="glass-panel rounded-2xl p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5 border border-border/40">
            <MessageSquare className="h-6 w-6 text-muted-foreground/40 mb-1" />
            <p className="font-medium text-foreground">No replies yet</p>
            <p>Be the first to leave an encrypted response in this discussion thread.</p>
          </div>
        ) : (
          <AnimatePresence>
            {comments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-2.5 border border-border/50 hover:border-primary/30 transition-colors"
              >
                {/* Header */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="text-base p-1 rounded-lg bg-muted/60 border border-border/40">
                      {comment.icon || '💬'}
                    </span>
                    <span className="font-semibold text-foreground">
                      Anonymous Contributor
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px]">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(comment.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Comment Content */}
                <div className="rounded-xl bg-black/20 p-3 text-sm font-mono text-foreground whitespace-pre-wrap break-words leading-relaxed border border-white/5">
                  {comment.plaintext}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

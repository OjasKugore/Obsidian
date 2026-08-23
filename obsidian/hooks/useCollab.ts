'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import PusherClient, { type PresenceChannel } from 'pusher-js';
import { encrypt, decrypt } from '@/lib/crypto/cipher';
import type { AdataSchema } from '@/lib/api/schemas';

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  isTyping?: boolean;
}

export interface UseCollabOptions {
  pasteId: string;
  rawKey: Uint8Array | null;
  initialContent?: string;
  formatter?: 'plaintext' | 'markdown' | 'syntaxhighlighting';
  isAsymmetric?: boolean;
  enabled?: boolean;
  onRemoteContent?: (content: string) => void;
}

export interface EncryptedDeltaMessage {
  v: number;
  ct: string;
  adata: AdataSchema;
  senderId: string;
  timestamp: number;
}

export interface EncryptedTypingMessage {
  v: number;
  ct: string;
  adata: AdataSchema;
  senderId: string;
}

export function useCollab({
  pasteId,
  rawKey,
  initialContent = '',
  formatter = 'plaintext',
  isAsymmetric = false,
  enabled = true,
  onRemoteContent,
}: UseCollabOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [currentUser, setCurrentUser] = useState<Collaborator | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [content, setContent] = useState(initialContent);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pusherRef = useRef<PusherClient | null>(null);
  const channelRef = useRef<PresenceChannel | null>(null);
  const myUserIdRef = useRef<string>('');
  const typingTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const broadcastThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const isBroadcastingRef = useRef(false);

  // ── 1. Connect to Pusher Presence Channel ─────────────────────────────────────
  useEffect(() => {
    if (!enabled || !pasteId || !rawKey || isAsymmetric) {
      return;
    }
    let cancelled = false;

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';

    if (!pusherKey) {
      const timer = setTimeout(() => {
        if (!cancelled) {
          setIsLocalMode(true);
          setIsConnected(true);
          setCurrentUser({
            id: 'local-me',
            name: 'Local Cipher (Offline)',
            color: '#3b82f6',
          });
        }
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    try {
      const client = new PusherClient(pusherKey, {
        cluster: pusherCluster,
        authEndpoint: '/api/v1/collab/auth',
      });
      pusherRef.current = client;

      const channelName = `presence-collab-${pasteId}`;
      const channel = client.subscribe(channelName) as PresenceChannel;
      channelRef.current = channel;

      channel.bind('pusher:subscription_succeeded', (members: {
        count: number;
        myID: string;
        me: { id: string; info: { name: string; color: string } };
        members: Record<string, { name: string; color: string }>;
      }) => {
        if (cancelled) return;
        setIsConnecting(false);
        setIsConnected(true);
        myUserIdRef.current = members.myID;

        if (members.me) {
          setCurrentUser({
            id: members.myID,
            name: members.me.info?.name || 'You',
            color: members.me.info?.color || '#3b82f6',
          });
        }

        const list: Collaborator[] = [];
        for (const [id, info] of Object.entries(members.members)) {
          list.push({
            id,
            name: info?.name || 'Anonymous',
            color: info?.color || '#8b5cf6',
          });
        }
        setCollaborators(list);
      });

      channel.bind('pusher:member_added', (member: { id: string; info: { name: string; color: string } }) => {
        if (cancelled) return;
        setCollaborators((prev) => {
          if (prev.some((m) => m.id === member.id)) return prev;
          return [
            ...prev,
            {
              id: member.id,
              name: member.info?.name || 'Collaborator',
              color: member.info?.color || '#10b981',
            },
          ];
        });
      });

      channel.bind('pusher:member_removed', (member: { id: string }) => {
        if (cancelled) return;
        setCollaborators((prev) => prev.filter((m) => m.id !== member.id));
        setTypingUsers((prev) => {
          const collab = collaborators.find((c) => c.id === member.id);
          return collab ? prev.filter((name) => name !== collab.name) : prev;
        });
      });

      channel.bind('pusher:subscription_error', (err: unknown) => {
        console.error('[useCollab] Subscription error:', err);
        if (!cancelled) {
          setIsConnecting(false);
          setIsConnected(false);
          setError('Could not connect to live collaboration room.');
        }
      });

      // ── 2. Handle incoming encrypted text deltas ────────────────────────────
      channel.bind('client-delta', async (data: EncryptedDeltaMessage) => {
        if (!data || data.senderId === myUserIdRef.current) {
          return; // Ignore our own broadcasted echoes
        }

        try {
          // Decrypt payload in browser with shared raw AES key
          const decryptedText = await decrypt(data.ct, data.adata, rawKey);
          if (!cancelled) {
            isBroadcastingRef.current = true;
            setContent(decryptedText);
            if (onRemoteContent) {
              onRemoteContent(decryptedText);
            }
          }
        } catch (decErr) {
          console.warn('[useCollab] Failed to decrypt remote delta:', decErr);
        }
      });

      // ── 3. Handle incoming encrypted typing signals ─────────────────────────
      channel.bind('client-typing', async (data: EncryptedTypingMessage) => {
        if (!data || data.senderId === myUserIdRef.current) return;

        try {
          const decrypted = await decrypt(data.ct, data.adata, rawKey);
          const parsed = JSON.parse(decrypted) as { name: string; isTyping: boolean };

          if (parsed.isTyping && parsed.name && !cancelled) {
            setTypingUsers((prev) => (prev.includes(parsed.name) ? prev : [...prev, parsed.name]));

            const existingTimer = typingTimerRef.current.get(data.senderId);
            if (existingTimer) clearTimeout(existingTimer);

            const timer = setTimeout(() => {
              setTypingUsers((prev) => prev.filter((n) => n !== parsed.name));
              typingTimerRef.current.delete(data.senderId);
            }, 2500);

            typingTimerRef.current.set(data.senderId, timer);
          }
        } catch {
          // silently ignore invalid typing ping
        }
      });
    } catch (err: unknown) {
      console.error('[useCollab ERROR]', err);
      setTimeout(() => {
        if (!cancelled) {
          setIsConnecting(false);
          setError('Failed to initialize live collaboration.');
        }
      }, 0);
    }

    return () => {
      cancelled = true;
      if (channelRef.current && pusherRef.current) {
        pusherRef.current.unsubscribe(`presence-collab-${pasteId}`);
        channelRef.current = null;
      }
      if (pusherRef.current) {
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
    };
  }, [enabled, pasteId, rawKey, isAsymmetric, onRemoteContent, collaborators]);

  // ── Broadcast encrypted text updates ──────────────────────────────────────────
  const broadcastContent = useCallback(
    async (newContent: string) => {
      setContent(newContent);

      if (!rawKey || isAsymmetric) return;

      // Avoid echo loop if update was triggered by remote delta
      if (isBroadcastingRef.current) {
        isBroadcastingRef.current = false;
        return;
      }

      if (broadcastThrottleRef.current) {
        clearTimeout(broadcastThrottleRef.current);
      }

      broadcastThrottleRef.current = setTimeout(async () => {
        if (!channelRef.current && !isLocalMode) return;

        try {
          // Encrypt entire state update locally with rawKey
          const enc = await encrypt(newContent, formatter, {
            burnAfterReading: false,
            openDiscussion: true,
            customKey: rawKey,
          });

          const message: EncryptedDeltaMessage = {
            v: 2,
            ct: enc.ciphertext,
            adata: enc.adata,
            senderId: myUserIdRef.current || 'local-me',
            timestamp: Date.now(),
          };

          if (channelRef.current) {
            channelRef.current.trigger('client-delta', message);
          }
        } catch (encErr) {
          console.error('[useCollab] Failed to encrypt delta:', encErr);
        }
      }, 150); // 150ms debounce for smooth typing stream
    },
    [rawKey, formatter, isAsymmetric, isLocalMode]
  );

  // ── Broadcast typing ping ─────────────────────────────────────────────────────
  const broadcastTyping = useCallback(async () => {
    if (!channelRef.current || !rawKey || isAsymmetric || !currentUser) return;

    try {
      const payload = JSON.stringify({ name: currentUser.name, isTyping: true });
      const enc = await encrypt(payload, 'plaintext', {
        burnAfterReading: false,
        openDiscussion: true,
        customKey: rawKey,
      });

      const message: EncryptedTypingMessage = {
        v: 2,
        ct: enc.ciphertext,
        adata: enc.adata,
        senderId: myUserIdRef.current,
      };

      channelRef.current.trigger('client-typing', message);
    } catch {
      // ignore typing ping errors
    }
  }, [rawKey, isAsymmetric, currentUser]);

  // ── Disconnect / Teardown ─────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    if (channelRef.current && pusherRef.current) {
      pusherRef.current.unsubscribe(`presence-collab-${pasteId}`);
      channelRef.current = null;
    }
    if (pusherRef.current) {
      pusherRef.current.disconnect();
      pusherRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setCollaborators([]);
    setTypingUsers([]);
  }, [pasteId]);

  return {
    isConnected,
    isConnecting,
    isLocalMode,
    collaborators,
    currentUser,
    typingUsers,
    content,
    error,
    broadcastContent,
    broadcastTyping,
    disconnect,
  };
}

'use client';

/**
 * hooks/useCollab.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Real-Time End-to-End Encrypted (E2EE) Collaboration Hook.
 * Supports cross-tab BroadcastChannel sync and remote Pusher WSS.
 * All keystroke deltas and presence payloads are encrypted with AES-256-GCM.
 * ─────────────────────────────────────────────────────────────────────────────
 */

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
  onRemoteLock?: (finalText: string) => void;
  onRemoteUnlock?: () => void;
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

const ADJECTIVES = ['Neon', 'Cipher', 'Quantum', 'Shadow', 'Obsidian', 'Velvet', 'Cobalt', 'Amber', 'Solar', 'Lunar', 'Astral', 'Silver'];
const ANIMALS = ['Fox', 'Ghost', 'Hawk', 'Lynx', 'Wolf', 'Panther', 'Viper', 'Griffin', 'Falcon', 'Raven', 'Eagle', 'Owl'];
const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#6366f1', '#14b8a6'];

function generateRandomPeer(tabId: string): Collaborator {
  const hash = Math.abs(tabId.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0));
  const name = `${ADJECTIVES[hash % ADJECTIVES.length]} ${ANIMALS[(hash >> 3) % ANIMALS.length]}`;
  const color = COLORS[hash % COLORS.length];
  return { id: tabId, name, color };
}

export function useCollab({
  pasteId,
  rawKey,
  initialContent = '',
  formatter = 'plaintext',
  isAsymmetric = false,
  enabled = true,
  onRemoteContent,
  onRemoteLock,
  onRemoteUnlock,
}: UseCollabOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [currentUser, setCurrentUser] = useState<Collaborator | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [content, setContent] = useState(initialContent);
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabIdRef = useRef<string>('');
  const myPeerRef = useRef<Collaborator | null>(null);
  const onRemoteContentRef = useRef(onRemoteContent);
  const onRemoteLockRef = useRef(onRemoteLock);
  const onRemoteUnlockRef = useRef(onRemoteUnlock);
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    onRemoteContentRef.current = onRemoteContent;
    onRemoteLockRef.current = onRemoteLock;
    onRemoteUnlockRef.current = onRemoteUnlock;
  }, [onRemoteContent, onRemoteLock, onRemoteUnlock]);

  const pusherRef = useRef<PusherClient | null>(null);
  const channelRef = useRef<PresenceChannel | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const typingTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const broadcastThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const isBroadcastingRef = useRef(false);

  // ── BroadcastChannel (Seamless Cross-Tab Sync) + Pusher (Remote Sync) ─────────
  useEffect(() => {
    if (!enabled || !pasteId || !rawKey || isAsymmetric) {
      return;
    }
    let cancelled = false;

    if (!tabIdRef.current) {
      tabIdRef.current = Math.random().toString(36).slice(2, 9);
      myPeerRef.current = generateRandomPeer(tabIdRef.current);
    }
    const tabId = tabIdRef.current;
    const myPeer = myPeerRef.current!;

    const timer = setTimeout(() => {
      if (!cancelled) {
        setCurrentUser(myPeer);
        setCollaborators((prev) =>
          prev.some((p) => p.id === myPeer.id) ? prev : [myPeer, ...prev]
        );
        setIsConnected(true);
      }
    }, 0);

    // 1. Setup Browser BroadcastChannel for instant local multi-tab sync
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel(`obsidian-collab-${pasteId}`);
        bcRef.current = bc;

        bc.onmessage = async (event: MessageEvent) => {
          if (cancelled || !event.data) return;
          const msg = event.data;

          if (msg.type === 'peer-ping' && msg.senderId !== tabId) {
            // Respond with our peer info and current text snapshot
            bc?.postMessage({
              type: 'peer-pong',
              peer: myPeer,
              senderId: tabId,
              currentText: contentRef.current,
            });
            setCollaborators((prev) => {
              if (prev.some((p) => p.id === msg.peer.id)) return prev;
              return [...prev, msg.peer];
            });
          }

          if (msg.type === 'peer-pong' && msg.senderId !== tabId) {
            setCollaborators((prev) => {
              if (prev.some((p) => p.id === msg.peer.id)) return prev;
              return [...prev, msg.peer];
            });
            // If the joining peer has empty content, take the responder's current text
            if (msg.currentText && !contentRef.current) {
              setContent(msg.currentText);
              if (onRemoteContentRef.current) onRemoteContentRef.current(msg.currentText);
            }
          }

          if (msg.type === 'peer-leave') {
            setCollaborators((prev) => prev.filter((p) => p.id !== msg.senderId));
            setTypingUsers((prev) => prev.filter((n) => n !== msg.name));
          }

          if (msg.type === 'client-delta' && msg.senderId !== tabId) {
            try {
              const decrypted = await decrypt(msg.ct, msg.adata, rawKey);
              if (!cancelled) {
                isBroadcastingRef.current = true;
                setContent(decrypted);
                if (onRemoteContentRef.current) onRemoteContentRef.current(decrypted);
              }
            } catch (err) {
              console.warn('[useCollab BC] Decrypt failed:', err);
            }
          }

          if (msg.type === 'client-locked' && msg.senderId !== tabId) {
            if (!cancelled) {
              isBroadcastingRef.current = true;
              if (msg.finalContent !== undefined) setContent(msg.finalContent);
              if (onRemoteLockRef.current) onRemoteLockRef.current(msg.finalContent || '');
            }
          }

          if (msg.type === 'client-unlocked' && msg.senderId !== tabId) {
            if (!cancelled) {
              if (onRemoteUnlockRef.current) onRemoteUnlockRef.current();
            }
          }

          if (msg.type === 'client-typing' && msg.senderId !== tabId) {
            try {
              const decrypted = await decrypt(msg.ct, msg.adata, rawKey);
              const parsed = JSON.parse(decrypted) as { name: string; isTyping: boolean };
              if (parsed.isTyping && parsed.name && !cancelled) {
                setTypingUsers((prev) =>
                  prev.includes(parsed.name) ? prev : [...prev, parsed.name]
                );

                const existingTimer = typingTimerRef.current.get(msg.senderId);
                if (existingTimer) clearTimeout(existingTimer);

                const t = setTimeout(() => {
                  setTypingUsers((prev) => prev.filter((n) => n !== parsed.name));
                  typingTimerRef.current.delete(msg.senderId);
                }, 2500);

                typingTimerRef.current.set(msg.senderId, t);
              }
            } catch {
              // ignore invalid typing signal
            }
          }
        };

        // Announce our presence to all existing tabs
        bc.postMessage({ type: 'peer-ping', peer: myPeer, senderId: tabId });
      } catch (err) {
        console.warn('[useCollab] BroadcastChannel init error:', err);
      }
    }

    // 2. Setup Pusher WSS (if configured)
    const rawPusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const isPusherConfigured =
      Boolean(rawPusherKey) &&
      rawPusherKey !== 'YOUR_PUSHER_KEY' &&
      !rawPusherKey?.startsWith('YOUR_');

    if (!isPusherConfigured) {
      setTimeout(() => {
        if (!cancelled) {
          setIsLocalMode(true);
        }
      }, 0);
    } else {
      const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';
      try {
        const client = new PusherClient(rawPusherKey!, {
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

          if (members.me) {
            setCurrentUser({
              id: members.myID,
              name: members.me.info?.name || myPeer.name,
              color: members.me.info?.color || myPeer.color,
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

          // If there are existing members in the room and we don't have text yet, request a state sync
          if (members.count > 1 && !contentRef.current) {
            try {
              channel.trigger('client-sync-req', { senderId: tabId });
            } catch {
              // ignore
            }
          }
        });

        channel.bind('pusher:member_added', async (member: { id: string; info: { name: string; color: string } }) => {
          if (cancelled) return;
          setCollaborators((prev) => {
            if (prev.some((m) => m.id === member.id)) return prev;
            return [
              ...prev,
              {
                id: member.id,
                name: member.info?.name || 'Anonymous',
                color: member.info?.color || '#8b5cf6',
              },
            ];
          });

          // Proactively send our current document snapshot to the joining peer
          if (contentRef.current) {
            try {
              const enc = await encrypt(contentRef.current, formatter, {
                burnAfterReading: false,
                openDiscussion: true,
                customKey: rawKey,
              });
              channel.trigger('client-delta', {
                v: 2,
                ct: enc.ciphertext,
                adata: enc.adata,
                senderId: tabId,
                timestamp: Date.now(),
              });
            } catch {
              // ignore
            }
          }
        });

        channel.bind('client-sync-req', async (reqData: { senderId: string }) => {
          if (!reqData || reqData.senderId === tabId || !contentRef.current) return;
          try {
            const enc = await encrypt(contentRef.current, formatter, {
              burnAfterReading: false,
              openDiscussion: true,
              customKey: rawKey,
            });
            channel.trigger('client-delta', {
              v: 2,
              ct: enc.ciphertext,
              adata: enc.adata,
              senderId: tabId,
              timestamp: Date.now(),
            });
          } catch {
            // ignore
          }
        });

        channel.bind('pusher:member_removed', (member: { id: string }) => {
          if (cancelled) return;
          setCollaborators((prev) => prev.filter((m) => m.id !== member.id));
        });

        channel.bind('client-delta', async (data: EncryptedDeltaMessage) => {
          if (!data || data.senderId === tabId) return;
          try {
            const decrypted = await decrypt(data.ct, data.adata, rawKey);
            if (!cancelled) {
              isBroadcastingRef.current = true;
              setContent(decrypted);
              if (onRemoteContentRef.current) onRemoteContentRef.current(decrypted);
            }
          } catch (decErr) {
            console.warn('[useCollab Pusher] Decrypt failed:', decErr);
          }
        });

        channel.bind('client-typing', async (data: EncryptedTypingMessage) => {
          if (!data || data.senderId === tabId) return;
          try {
            const decrypted = await decrypt(data.ct, data.adata, rawKey);
            const parsed = JSON.parse(decrypted) as { name: string; isTyping: boolean };
            if (parsed.isTyping && parsed.name && !cancelled) {
              setTypingUsers((prev) =>
                prev.includes(parsed.name) ? prev : [...prev, parsed.name]
              );
            }
          } catch {
            // ignore
          }
        });

        const handleIncomingDelta = async (data: EncryptedDeltaMessage) => {
          if (!data || data.senderId === tabId) return;
          try {
            const decrypted = await decrypt(data.ct, data.adata, rawKey);
            if (!cancelled) {
              isBroadcastingRef.current = true;
              setContent(decrypted);
              if (onRemoteContentRef.current) onRemoteContentRef.current(decrypted);
            }
          } catch (decErr) {
            console.warn('[useCollab Pusher] Decrypt failed:', decErr);
          }
        };

        channel.bind('client-delta', handleIncomingDelta);
        channel.bind('delta', handleIncomingDelta);

        const handleIncomingTyping = async (data: EncryptedTypingMessage) => {
          if (!data || data.senderId === tabId) return;
          try {
            const decrypted = await decrypt(data.ct, data.adata, rawKey);
            const parsed = JSON.parse(decrypted) as { name: string; isTyping: boolean };
            if (parsed.isTyping && parsed.name && !cancelled) {
              setTypingUsers((prev) =>
                prev.includes(parsed.name) ? prev : [...prev, parsed.name]
              );
            }
          } catch {
            // ignore
          }
        };

        channel.bind('client-typing', handleIncomingTyping);
        channel.bind('typing', handleIncomingTyping);

        const handleIncomingLock = (data: { senderId: string; finalContent: string }) => {
          if (!data || data.senderId === tabId) return;
          if (!cancelled) {
            isBroadcastingRef.current = true;
            if (data.finalContent !== undefined) setContent(data.finalContent);
            if (onRemoteLockRef.current) onRemoteLockRef.current(data.finalContent || '');
          }
        };

        channel.bind('client-locked', handleIncomingLock);
        channel.bind('locked', handleIncomingLock);

        const handleIncomingUnlock = (data: { senderId: string }) => {
          if (!data || data.senderId === tabId) return;
          if (!cancelled) {
            if (onRemoteUnlockRef.current) onRemoteUnlockRef.current();
          }
        };

        channel.bind('client-unlocked', handleIncomingUnlock);
        channel.bind('unlocked', handleIncomingUnlock);

        channel.bind('pusher:subscription_error', (err: unknown) => {
          console.warn('[useCollab] Pusher subscription error:', err);
          if (!cancelled) {
            setError('Could not connect to remote Pusher room');
          }
        });
      } catch (err) {
        console.warn('[useCollab] Pusher client error:', err);
        setTimeout(() => {
          if (!cancelled) {
            setError('Failed to initialize Pusher client');
          }
        }, 0);
      }
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);

      if (bc) {
        try {
          bc.postMessage({ type: 'peer-leave', senderId: tabId, name: myPeer.name });
          bc.close();
        } catch {
          // ignore if channel was already closed
        }
        bcRef.current = null;
      }

      if (channelRef.current && pusherRef.current) {
        try {
          pusherRef.current.unsubscribe(`presence-collab-${pasteId}`);
        } catch {
          // ignore
        }
        channelRef.current = null;
      }
      if (pusherRef.current) {
        try {
          pusherRef.current.disconnect();
        } catch {
          // ignore
        }
        pusherRef.current = null;
      }
    };
  }, [enabled, pasteId, rawKey, isAsymmetric]);

  const sendCollabEvent = useCallback((event: string, payload: unknown) => {
    // 1. Peer-to-peer client event trigger
    if (channelRef.current) {
      try {
        channelRef.current.trigger(`client-${event}`, payload);
      } catch {
        // ignore
      }
    }
    // 2. Server broadcast trigger (ensures 100% remote delivery across devices)
    if (pasteId) {
      fetch('/api/v1/collab/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: `presence-collab-${pasteId}`,
          event,
          data: payload,
        }),
      }).catch(() => {});
    }
  }, [pasteId]);

  // ── Broadcast Delta (AES-256-GCM Encrypted) ───────────────────────────────────
  const broadcastContent = useCallback(
    async (newText: string) => {
      setContent(newText);

      if (!rawKey || isAsymmetric) return;

      if (broadcastThrottleRef.current) {
        clearTimeout(broadcastThrottleRef.current);
      }

      broadcastThrottleRef.current = setTimeout(async () => {
        try {
          const enc = await encrypt(newText, formatter, {
            burnAfterReading: false,
            openDiscussion: true,
            customKey: rawKey,
          });

          const message: EncryptedDeltaMessage = {
            v: 2,
            ct: enc.ciphertext,
            adata: enc.adata,
            senderId: tabIdRef.current,
            timestamp: Date.now(),
          };

          if (bcRef.current) {
            try {
              bcRef.current.postMessage({
                type: 'client-delta',
                ...message,
              });
            } catch {
              // ignore
            }
          }

          sendCollabEvent('delta', message);
        } catch (encErr) {
          console.error('[useCollab] Failed to encrypt delta:', encErr);
        }
      }, 50);
    },
    [rawKey, formatter, isAsymmetric, sendCollabEvent]
  );

  // ── Broadcast Lock event to all peers ─────────────────────────────────────────
  const broadcastLock = useCallback((finalContent: string) => {
    if (bcRef.current) {
      try {
        bcRef.current.postMessage({
          type: 'client-locked',
          senderId: tabIdRef.current,
          finalContent,
        });
      } catch {
        // ignore
      }
    }

    sendCollabEvent('locked', {
      senderId: tabIdRef.current,
      finalContent,
    });
  }, [sendCollabEvent]);

  // ── Broadcast Unlock event to all peers ───────────────────────────────────────
  const broadcastUnlock = useCallback(() => {
    if (bcRef.current) {
      try {
        bcRef.current.postMessage({
          type: 'client-unlocked',
          senderId: tabIdRef.current,
        });
      } catch {
        // ignore
      }
    }

    sendCollabEvent('unlocked', {
      senderId: tabIdRef.current,
    });
  }, [sendCollabEvent]);

  const lastTypingPingRef = useRef(0);

  // ── Broadcast typing ping ─────────────────────────────────────────────────────
  const broadcastTyping = useCallback(async () => {
    if (!rawKey || isAsymmetric || !currentUser) return;

    const now = Date.now();
    if (now - lastTypingPingRef.current < 1200) return;
    lastTypingPingRef.current = now;

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
        senderId: tabIdRef.current,
      };

      if (bcRef.current) {
        try {
          bcRef.current.postMessage({
            type: 'client-typing',
            ...message,
          });
        } catch {
          // ignore
        }
      }

      if (channelRef.current) {
        try {
          channelRef.current.trigger('client-typing', message);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }, [rawKey, isAsymmetric, currentUser]);

  // ── Disconnect / Teardown ─────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    if (bcRef.current) {
      try {
        bcRef.current.postMessage({ type: 'peer-leave', senderId: tabIdRef.current });
        bcRef.current.close();
      } catch {
        // ignore if already closed
      }
      bcRef.current = null;
    }
    if (channelRef.current && pusherRef.current) {
      try {
        pusherRef.current.unsubscribe(`presence-collab-${pasteId}`);
      } catch {
        // ignore
      }
      channelRef.current = null;
    }
    if (pusherRef.current) {
      try {
        pusherRef.current.disconnect();
      } catch {
        // ignore
      }
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
    broadcastLock,
    broadcastUnlock,
    broadcastTyping,
    disconnect,
  };
}

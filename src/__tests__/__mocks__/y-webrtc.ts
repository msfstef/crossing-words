/**
 * Mock for y-webrtc module
 * This file provides the mock implementation that vitest will use
 */

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

/**
 * Event emitter map for tracking listeners
 */
type EventMap = {
  status: Array<(event: { connected: boolean }) => void>;
  peers: Array<(event: { added?: string[]; removed?: string[]; webrtcPeers?: string[] }) => void>;
  [key: string]: Array<(...args: any[]) => void>;
};

/**
 * Mock WebrtcProvider implementation
 */
export class WebrtcProvider {
  public doc: Y.Doc;
  public awareness: Awareness;
  public roomId: string;
  public connected = false;
  public destroyed = false;

  private eventListeners: EventMap = {
    status: [],
    peers: [],
  };

  private peers: Set<string> = new Set();

  public manualControl = {
    connect: () => this.simulateConnect(),
    disconnect: () => this.simulateDisconnect(),
    addPeer: (peerId: string) => this.simulateAddPeer(peerId),
    removePeer: (peerId: string) => this.simulateRemovePeer(peerId),
  };

  constructor(roomId: string, doc: Y.Doc, _options?: any) {
    this.roomId = roomId;
    this.doc = doc;
    this.awareness = new Awareness(doc);

    // Auto-connect after a short delay
    setTimeout(() => {
      if (!this.destroyed) {
        this.simulateConnect();
      }
    }, 100);
  }

  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  connect(): void {
    setTimeout(() => this.simulateConnect(), 50);
  }

  disconnect(): void {
    this.simulateDisconnect();
  }

  destroy(): void {
    this.destroyed = true;
    this.simulateDisconnect();
    this.eventListeners = { status: [], peers: [] };
    this.awareness.destroy();
  }

  private simulateConnect(): void {
    if (this.destroyed) return;
    this.connected = true;
    this.emit('status', { connected: true });
  }

  private simulateDisconnect(): void {
    this.connected = false;
    this.emit('status', { connected: false });

    const removedPeers = Array.from(this.peers);
    this.peers.clear();
    if (removedPeers.length > 0) {
      this.emit('peers', {
        removed: removedPeers,
        webrtcPeers: [],
      });
    }
  }

  private simulateAddPeer(peerId: string): void {
    if (!this.peers.has(peerId)) {
      this.peers.add(peerId);
      this.emit('peers', {
        added: [peerId],
        webrtcPeers: Array.from(this.peers),
      });
    }
  }

  private simulateRemovePeer(peerId: string): void {
    if (this.peers.has(peerId)) {
      this.peers.delete(peerId);
      this.emit('peers', {
        removed: [peerId],
        webrtcPeers: Array.from(this.peers),
      });
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners[event] || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }
}

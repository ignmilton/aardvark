'use client';

import { useState, useEffect, useCallback } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermissionState>('prompt');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission as PushPermissionState);

    // Check existing subscription
    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        setSubscription(sub);
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      console.warn('VAPID public key not configured');
      return null;
    }

    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermissionState);

      if (result !== 'granted') {
        return null;
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      setSubscription(sub);

      // Send subscription to backend
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(sub.toJSON()),
      });

      return sub;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;

    setIsLoading(true);
    try {
      await subscription.unsubscribe();

      // Notify backend
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      await fetch('/api/notifications/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      setSubscription(null);
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [subscription]);

  return {
    permission,
    subscription,
    isSubscribed: !!subscription,
    isLoading,
    subscribe,
    unsubscribe,
  };
}

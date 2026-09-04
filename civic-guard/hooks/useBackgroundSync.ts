"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import localforage from "localforage";
import { OfflineReportPayload, OFFLINE_REPORT_PREFIX } from "@/lib/offline-types";

// ---------------------------------------------------------------------------
// useBackgroundSync — Silently flushes offline report queue on reconnection
// ---------------------------------------------------------------------------

interface BackgroundSyncResult {
  /** True while the sync engine is actively flushing the queue */
  isSyncing: boolean;
  /** Number of reports still waiting in IndexedDB */
  pendingCount: number;
  /** Manually trigger a flush (e.g., from a retry button) */
  flushQueue: () => Promise<void>;
}

/**
 * Custom hook that listens for the browser `online` event and flushes
 * any pending offline reports from IndexedDB to the `/api/report` endpoint.
 *
 * @param onReportSynced - Callback to inject the new report into React state
 * @param onToast - Callback to show a toast notification
 */
export function useBackgroundSync(
  onReportSynced: (updater: (prev: unknown[]) => unknown[]) => void,
  onToast: (toast: { message: string; type: "success" | "error" | "info" }) => void
): BackgroundSyncResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const isFlushing = useRef(false);

  // Count pending items on mount
  const refreshPendingCount = useCallback(async () => {
    try {
      const keys = await localforage.keys();
      const pending = keys.filter((k) => k.startsWith(OFFLINE_REPORT_PREFIX));
      setPendingCount(pending.length);
    } catch {
      // localforage not available (SSR guard)
    }
  }, []);

  const flushQueue = useCallback(async () => {
    // Prevent concurrent flushes
    if (isFlushing.current) return;
    if (!navigator.onLine) return;

    isFlushing.current = true;
    setIsSyncing(true);

    try {
      const keys = await localforage.keys();
      const reportKeys = keys.filter((k) => k.startsWith(OFFLINE_REPORT_PREFIX));

      if (reportKeys.length === 0) {
        setIsSyncing(false);
        isFlushing.current = false;
        return;
      }

      let syncedCount = 0;

      for (const key of reportKeys) {
        const payload = await localforage.getItem<OfflineReportPayload>(key);
        if (!payload) {
          await localforage.removeItem(key);
          continue;
        }

        try {
          // Reconstruct a File from the Base64 data
          const byteString = atob(payload.imageBase64);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: payload.imageMimeType });
          const file = new File([blob], payload.imageFileName, {
            type: payload.imageMimeType,
          });

          const formData = new FormData();
          formData.append("image", file);
          formData.append("latitude", String(payload.latitude));
          formData.append("longitude", String(payload.longitude));

          const res = await fetch("/api/report", {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            // Success — remove from IndexedDB and inject into state
            const { report } = await res.json();
            await localforage.removeItem(key);
            syncedCount++;
            onReportSynced((prev) => [report, ...prev]);
          } else if (res.status === 401) {
            // Auth expired — stop the queue, user needs to re-login
            console.warn("[BackgroundSync] Auth expired, pausing queue.");
            onToast({
              message: "Session expired. Please sign in to sync offline reports.",
              type: "error",
            });
            break;
          } else {
            // Server error (5xx, 429, etc.) — leave in IndexedDB for next cycle
            console.warn(`[BackgroundSync] Server returned ${res.status} for ${key}, will retry.`);
          }
        } catch (networkErr) {
          // Network failed mid-flush — stop and retry later
          console.warn("[BackgroundSync] Network error during flush:", networkErr);
          break;
        }
      }

      if (syncedCount > 0) {
        onToast({
          message: `✅ Synced ${syncedCount} offline report${syncedCount > 1 ? "s" : ""} successfully!`,
          type: "success",
        });
        // Notify LoginButton to refresh points
        window.dispatchEvent(new CustomEvent("civicPointsUpdate"));
      }
    } catch (err) {
      console.error("[BackgroundSync] Flush error:", err);
    } finally {
      setIsSyncing(false);
      isFlushing.current = false;
      await refreshPendingCount();
    }
  }, [onReportSynced, onToast, refreshPendingCount]);

  useEffect(() => {
    // Count pending on mount
    refreshPendingCount();

    // If already online, try flushing any leftover items from a previous session
    if (navigator.onLine) {
      flushQueue();
    }

    // Listen for reconnection
    const handleOnline = () => {
      flushQueue();
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [flushQueue, refreshPendingCount]);

  return { isSyncing, pendingCount, flushQueue };
}

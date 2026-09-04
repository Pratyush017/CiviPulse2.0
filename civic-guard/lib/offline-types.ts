// ---------------------------------------------------------------------------
// Offline Report Payload — Typed schema for IndexedDB caching via localforage
// ---------------------------------------------------------------------------

export interface OfflineReportPayload {
  /** Locally generated crypto UUID */
  id: string;
  /** Base64-encoded image data (no data URI prefix) */
  imageBase64: string;
  /** MIME type of the original image file */
  imageMimeType: string;
  /** Original filename for reconstruction */
  imageFileName: string;
  /** GPS latitude */
  latitude: number;
  /** GPS longitude */
  longitude: number;
  /** Queue status for the background sync engine */
  sync_status: 'pending' | 'synced' | 'failed';
  /** ISO 8601 timestamp of when the report was cached offline */
  created_at: string;
}

/** Prefix used for all offline report keys in localforage */
export const OFFLINE_REPORT_PREFIX = 'report_';

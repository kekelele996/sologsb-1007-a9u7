import { createSeedProject } from "./data";
import type { DeliveryLedger, LedgerEnvelope, PersistedEnvelope, ProjectData } from "./types";

export const STORAGE_KEY = "sologsb-1007-project-v1";
export const LEDGER_KEY = "sologsb-1007-ledger-v1";
export const SESSION_KEY = "sologsb-1007-session";
const RETRY_KEY = "sologsb-1007-retry-v1";

type SaveSide = "project" | "ledger";

const readRetryFlags = (): Record<SaveSide, boolean> => {
  if (typeof localStorage === "undefined") return { project: false, ledger: false };
  try {
    const parsed = JSON.parse(localStorage.getItem(RETRY_KEY) ?? "{}");
    return { project: !!parsed?.project, ledger: !!parsed?.ledger };
  } catch {
    return { project: false, ledger: false };
  }
};

const writeRetryFlags = (flags: Record<SaveSide, boolean>) => {
  try {
    localStorage.setItem(RETRY_KEY, JSON.stringify(flags));
  } catch {
    // 连标记都写不下时，本轮内存里的保存状态仍会提示失败。
  }
};

/** 上次哪一边保存失败留下的标记；下次打开只重试那一份，核过的不再重来。 */
export function pendingSaveRetry(side: SaveSide): boolean {
  return readRetryFlags()[side];
}

const markSaveFailed = (side: SaveSide) => writeRetryFlags({ ...readRetryFlags(), [side]: true });
const clearSaveFailed = (side: SaveSide) => writeRetryFlags({ ...readRetryFlags(), [side]: false });

export function loadProject(): { project: ProjectData; revision: number } {
  if (typeof localStorage === "undefined") {
    return { project: createSeedProject(), revision: 0 };
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "") as PersistedEnvelope;
    if (parsed?.schema === 1 && parsed.project?.tracks?.length) {
      return { project: parsed.project, revision: parsed.revision ?? 0 };
    }
  } catch {
    // A malformed local draft falls back to the bundled sample.
  }
  return { project: createSeedProject(), revision: 0 };
}

export function saveProject(project: ProjectData, revision: number, tabId: string): PersistedEnvelope | null {
  const envelope: PersistedEnvelope = {
    schema: 1,
    revision,
    tabId,
    savedAt: Date.now(),
    project,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    clearSaveFailed("project");
    return envelope;
  } catch {
    markSaveFailed("project");
    return null;
  }
}

export function loadLedger(): { ledger: DeliveryLedger; revision: number } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(LEDGER_KEY) ?? "") as LedgerEnvelope;
    if (parsed?.schema === 1 && Array.isArray(parsed.ledger?.entries)) {
      return { ledger: parsed.ledger, revision: parsed.revision ?? 0 };
    }
  } catch {
    // 台账损坏时按没有台账处理，由调用方按现有片段补建。
  }
  return null;
}

export function saveLedger(ledger: DeliveryLedger, revision: number, tabId: string): LedgerEnvelope | null {
  const envelope: LedgerEnvelope = {
    schema: 1,
    revision,
    tabId,
    savedAt: Date.now(),
    ledger,
  };
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(envelope));
    clearSaveFailed("ledger");
    return envelope;
  } catch {
    markSaveFailed("ledger");
    return null;
  }
}

export function readEnvelope(): PersistedEnvelope | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "") as PersistedEnvelope;
  } catch {
    return null;
  }
}

export function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function formatTime(seconds: number, withMillis = true) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  const head = [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
  return withMillis ? `${head}.${String(ms).padStart(3, "0")}` : head;
}

export function parseTime(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(normalized) || 0;
}

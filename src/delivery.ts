import type {
  DeliveryEntry,
  DeliveryLedger,
  DeliverySnapshot,
  ProjectData,
  SaveOutbox,
  Segment,
} from "./types";

export const LEDGER_KEY = "sologsb-1007-delivery-v1";
export const OUTBOX_KEY = "sologsb-1007-outbox-v1";
const LEDGER_SCHEMA = 1;

/** 取片段的可交付内容指纹：正文、时间码、发言人。 */
export const snapshotOf = (segment: Segment): DeliverySnapshot => ({
  text: segment.text,
  start: segment.start,
  end: segment.end,
  speakerId: segment.speakerId,
});

export const snapshotEqual = (a: DeliverySnapshot | null, b: DeliverySnapshot) =>
  !!a && a.text === b.text && a.start === b.start && a.end === b.end && a.speakerId === b.speakerId;

const emptyOutbox = (): SaveOutbox => ({
  schema: 1,
  pendingManuscript: false,
  pendingLedger: false,
  lastFailedAt: null,
  lastFailedCopy: null,
});

export function loadOutbox(): SaveOutbox {
  if (typeof localStorage === "undefined") return emptyOutbox();
  try {
    const parsed = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "") as SaveOutbox;
    if (parsed?.schema === 1) return { ...emptyOutbox(), ...parsed };
  } catch {
    // 标记本身损坏时按无待重试处理。
  }
  return emptyOutbox();
}

export function writeOutbox(outbox: SaveOutbox): boolean {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
    return true;
  } catch {
    return false;
  }
}

export function loadLedger(projectId: string): DeliveryLedger | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(LEDGER_KEY) ?? "") as DeliveryLedger;
    if (parsed?.schema === LEDGER_SCHEMA && parsed.projectId === projectId && parsed.entries) {
      return parsed;
    }
  } catch {
    // 台账损坏时按无台账处理，触发重建。
  }
  return null;
}

export function saveLedger(ledger: DeliveryLedger): boolean {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
    return true;
  } catch {
    return false;
  }
}

/**
 * 旧稿升级：按现有片段补出交付条目。
 * 先前标过已校对的片段先不放进去（它们在旧流程里已处理）。
 */
export function createLedgerFromProject(
  project: ProjectData,
  options: { skipReviewed?: boolean } = {},
): DeliveryLedger {
  const now = new Date().toISOString();
  const entries: Record<string, DeliveryEntry> = {};
  for (const track of project.tracks) {
    for (const segment of track.segments) {
      if (options.skipReviewed && segment.reviewed) continue;
      entries[segment.id] = {
        segmentId: segment.id,
        trackId: track.id,
        status: "pending",
        deliveredSnapshot: null,
        deliveredAt: null,
        returnedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    }
  }
  return { schema: LEDGER_SCHEMA, projectId: project.id, entries, updatedAt: now };
}

export function findSegment(project: ProjectData, segmentId: string) {
  for (const track of project.tracks) {
    const segment = track.segments.find((item) => item.id === segmentId);
    if (segment) return { track, segment };
  }
  return null;
}

export interface ReconcileResult {
  ledger: DeliveryLedger;
  changed: boolean;
  invalidated: string[];
  added: string[];
}

/**
 * 让台账与稿库对齐。稿库是内容的唯一来源：这里只读取片段、改写台账，
 * 绝不把台账内容写回稿库，因此校对员还没落盘的原句会原样保留。
 * - 已交付条目若正文/时间码/发言人发生变化，作废并退回待交；
 * - 片段已不存在（合并/删除）的条目予以清除；
 * - 台账里没有的片段补一条待交。
 * 已交付且未改动的条目（核过的）一律不动，不重来。
 */
export function reconcileLedger(ledger: DeliveryLedger, project: ProjectData): ReconcileResult {
  const now = new Date().toISOString();
  const next: DeliveryLedger = structuredClone(ledger);
  next.updatedAt = now;
  const invalidated: string[] = [];
  const added: string[] = [];
  const seen = new Set<string>();
  let mutated = false;

  for (const track of project.tracks) {
    for (const segment of track.segments) {
      seen.add(segment.id);
      const current = snapshotOf(segment);
      const entry = next.entries[segment.id];
      if (!entry) {
        next.entries[segment.id] = {
          segmentId: segment.id,
          trackId: track.id,
          status: "pending",
          deliveredSnapshot: null,
          deliveredAt: null,
          returnedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        added.push(segment.id);
        mutated = true;
        continue;
      }
      if (entry.trackId !== track.id) {
        entry.trackId = track.id;
        mutated = true;
      }
      if (entry.status === "delivered" && !snapshotEqual(entry.deliveredSnapshot, current)) {
        entry.status = "returned";
        entry.returnedAt = now;
        entry.updatedAt = now;
        invalidated.push(segment.id);
        mutated = true;
      }
    }
  }

  for (const segmentId of Object.keys(next.entries)) {
    if (!seen.has(segmentId)) {
      delete next.entries[segmentId];
      mutated = true;
    }
  }

  return { ledger: mutated ? next : ledger, changed: mutated, invalidated, added };
}

export function deliveryStats(ledger: DeliveryLedger) {
  const entries = Object.values(ledger.entries);
  return {
    total: entries.length,
    pending: entries.filter((entry) => entry.status === "pending").length,
    delivered: entries.filter((entry) => entry.status === "delivered").length,
    returned: entries.filter((entry) => entry.status === "returned").length,
  };
}

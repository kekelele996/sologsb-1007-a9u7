import { uid } from "./data";
import type { DeliveryEntry, DeliveryLedger, ProjectData, Segment } from "./types";

export const emptyLedger = (): DeliveryLedger => ({
  id: uid("ledger"),
  entries: [],
  updatedAt: new Date().toISOString(),
});

const entryContentDiffers = (entry: DeliveryEntry, segment: Segment) =>
  entry.text !== segment.text ||
  entry.start !== segment.start ||
  entry.end !== segment.end ||
  entry.speakerId !== segment.speakerId;

const createEntry = (trackId: string, segment: Segment, now: string): DeliveryEntry => ({
  id: uid("delivery"),
  trackId,
  segmentId: segment.id,
  speakerId: segment.speakerId,
  start: segment.start,
  end: segment.end,
  text: segment.text,
  status: "待交",
  returned: false,
  updatedAt: now,
  deliveredAt: null,
});

/**
 * 把稿库内容核对进交付台账（只读稿库，绝不回写）：
 * - 片段正文、时间码或发言人一变，对应条目作废退回“待交”，已交付过的同时标记“打回”；
 * - 内容一致的条目原样保留，核过的不再重新登记；
 * - 还没有条目的片段，只有未校对的才补登（已校对的先不进台账）；
 * - 稿库里已不存在的片段（合并、删除），对应条目从台账移除。
 */
export function syncLedgerWithProject(
  project: ProjectData,
  ledger: DeliveryLedger,
): { ledger: DeliveryLedger; changed: boolean } {
  const now = new Date().toISOString();
  const stale = new Map(ledger.entries.map((entry) => [entry.segmentId, entry]));
  const entries: DeliveryEntry[] = [];
  let changed = false;

  for (const track of project.tracks) {
    for (const segment of track.segments) {
      const existing = stale.get(segment.id);
      if (!existing) {
        if (!segment.reviewed) {
          entries.push(createEntry(track.id, segment, now));
          changed = true;
        }
        continue;
      }
      stale.delete(segment.id);
      if (entryContentDiffers(existing, segment)) {
        entries.push({
          ...existing,
          trackId: track.id,
          speakerId: segment.speakerId,
          start: segment.start,
          end: segment.end,
          text: segment.text,
          status: "待交",
          returned: existing.returned || existing.status === "已交付",
          updatedAt: now,
        });
        changed = true;
      } else if (existing.trackId !== track.id) {
        entries.push({ ...existing, trackId: track.id });
        changed = true;
      } else {
        entries.push(existing);
      }
    }
  }

  if (stale.size) changed = true;
  if (!changed) return { ledger, changed: false };
  return { ledger: { ...ledger, entries, updatedAt: now }, changed: true };
}

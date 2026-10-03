export type Confidence = 1 | 2 | 3 | 4 | 5;

export interface Reply {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface ReviewComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  resolved: boolean;
  replies: Reply[];
}

export interface Speaker {
  id: string;
  name: string;
  role: string;
  color: string;
}

export interface Tag {
  id: string;
  label: string;
  type: "topic" | "event" | "person";
  color: string;
}

export interface Segment {
  id: string;
  start: number;
  end: number;
  speakerId: string;
  text: string;
  confidence: Confidence;
  reviewed: boolean;
  flags: {
    lowConfidence: boolean;
    dialect: boolean;
    properNoun: boolean;
  };
  tagIds: string[];
  comments: ReviewComment[];
}

export interface TranscriptTrack {
  id: string;
  name: string;
  language: string;
  status: "待校对" | "校对中" | "已完成";
  segments: Segment[];
}

export interface ProjectData {
  id: string;
  title: string;
  interviewee: string;
  recordingDate: string;
  activeTrackId: string;
  speakers: Speaker[];
  tags: Tag[];
  tracks: TranscriptTrack[];
  updatedAt: string;
}

export interface PersistedEnvelope {
  schema: 1;
  revision: number;
  tabId: string;
  savedAt: number;
  project: ProjectData;
}

// --- 交付台账 ---

export type DeliveryStatus = "pending" | "delivered" | "returned";

/** 可交付内容的指纹：正文、时间码、发言人。 */
export interface DeliverySnapshot {
  text: string;
  start: number;
  end: number;
  speakerId: string;
}

export interface DeliveryEntry {
  segmentId: string;
  trackId: string;
  status: DeliveryStatus;
  /** 最近一次标记交付时的内容快照；作废后保留以便对照。 */
  deliveredSnapshot: DeliverySnapshot | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryLedger {
  schema: 1;
  projectId: string;
  entries: Record<string, DeliveryEntry>;
  updatedAt: string;
}

/** 保存失败后的待重试标记：稿库与台账各自独立。 */
export interface SaveOutbox {
  schema: 1;
  pendingManuscript: boolean;
  pendingLedger: boolean;
  lastFailedAt: string | null;
  lastFailedCopy: "manuscript" | "ledger" | null;
}

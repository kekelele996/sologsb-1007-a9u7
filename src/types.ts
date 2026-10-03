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

export type DeliveryStatus = "待交" | "已交付";

export interface DeliveryEntry {
  id: string;
  trackId: string;
  segmentId: string;
  /** 台账自己持有的一份内容快照，与稿库互不为对方覆写。 */
  speakerId: string;
  start: number;
  end: number;
  text: string;
  status: DeliveryStatus;
  /** 已交付后因正文/时间码/发言人改动被打回退回待交的条目。 */
  returned: boolean;
  updatedAt: string;
  deliveredAt: string | null;
}

export interface DeliveryLedger {
  id: string;
  entries: DeliveryEntry[];
  updatedAt: string;
}

export interface LedgerEnvelope {
  schema: 1;
  revision: number;
  tabId: string;
  savedAt: number;
  ledger: DeliveryLedger;
}

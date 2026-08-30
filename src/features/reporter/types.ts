/**
 * Safe reporter-facing shapes returned by the workspace/history API.
 *
 * Keep this module free of database and server-only imports. The reporter
 * client must never receive session material, audit payloads, or internal AI
 * metadata.
 */

export type ReporterMessage = {
  id: string;
  senderType: "REPORTER" | "AI" | "COORDINATOR";
  body: string;
  createdAt: string;
};

export type ReporterHistoryItem = {
  caseId: string;
  publicRef: string;
  status: string;
  chatMode: string;
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
};

export type ReporterTranscript = {
  caseId: string;
  publicRef: string;
  status: string;
  chatMode: string;
  aiProvider: string;
  messages: ReporterMessage[];
};


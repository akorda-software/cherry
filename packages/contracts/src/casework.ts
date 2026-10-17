export const PRIVACY_REQUEST_CATEGORIES = [
  "access",
  "rectification",
  "erasure",
  "restriction",
  "portability",
  "objection"
] as const;
export type PrivacyRequestCategory = (typeof PRIVACY_REQUEST_CATEGORIES)[number];
export type CaseKind = "report" | "complaint" | "privacy" | "appeal" | "measure";
export type CaseOutcome = "dismissed" | "warning" | "suspend" | "answered" | "refused" | "upheld" | "overturned";

/** Only the requesting/affected user's projection. Never includes reporter, subject or staff identities. */
export interface SupportCase {
  id: string;
  kind: CaseKind;
  category: string;
  status: "open" | "resolved";
  statement: string | null;
  outcome: CaseOutcome | null;
  response: string | null;
  insertedAt: string;
  resolvedAt: string | null;
  canAppeal: boolean;
}

export type CreateSupportCaseRequest =
  | { kind: "privacy"; category: PrivacyRequestCategory; statement: string }
  | { kind: "complaint"; category: "service" | "safety" | "other"; statement: string };

export interface CaseNotice {
  id: string;
  caseId: string;
  event: "received" | "resolved";
  message: string;
  readAt: string | null;
  insertedAt: string;
}

export const MAX_CASE_STATEMENT_LENGTH = 4000;
export const MIN_CASE_STATEMENT_LENGTH = 10;
export const CASE_PAGE_SIZE = 50;

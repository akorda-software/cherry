import { describe, expect, it } from "vitest";
import {
  CASE_PAGE_SIZE,
  MAX_CASE_STATEMENT_LENGTH,
  MIN_CASE_STATEMENT_LENGTH,
  PRIVACY_REQUEST_CATEGORIES
} from "./casework";

describe("casework boundaries", () => {
  it("keeps the backend request categories and text/page limits explicit", () => {
    expect(PRIVACY_REQUEST_CATEGORIES).toEqual([
      "access",
      "rectification",
      "erasure",
      "restriction",
      "portability",
      "objection"
    ]);
    expect(CASE_PAGE_SIZE).toBe(50);
    expect(MIN_CASE_STATEMENT_LENGTH).toBe(10);
    expect(MAX_CASE_STATEMENT_LENGTH).toBe(4000);
  });
});

export type ExamStatus = "UPCOMING" | "IN_PROGRESS" | "COMPLETED";

/** The API stores only dates for an exam; its status follows from them. */
export function examStatus(startDate: string, endDate: string, today = new Date()): ExamStatus {
  const day = today.toISOString().slice(0, 10);
  if (endDate < day) return "COMPLETED";
  if (startDate > day) return "UPCOMING";
  return "IN_PROGRESS";
}

export const EXAM_STATUS_TONE: Record<ExamStatus, "violet" | "yellow" | "green"> = {
  UPCOMING: "violet",
  IN_PROGRESS: "yellow",
  COMPLETED: "green",
};

export const EXAM_TERMS = ["Unit Test", "Quarterly", "Half Yearly", "Annual"] as const;

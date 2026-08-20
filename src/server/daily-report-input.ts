export type ReportCandidate = { capturedDay: string; reportIncluded: boolean };

export function selectReportThoughts<T extends ReportCandidate>(thoughts: T[], date: string) {
  return thoughts.filter((thought) => thought.capturedDay === date && thought.reportIncluded);
}

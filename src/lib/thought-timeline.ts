export type DatedThought = { capturedAt: string };

export function shanghaiDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function localDateKey(value: string | Date) {
  return shanghaiDateKey(value);
}

export function filterThoughtsForDate<T extends DatedThought>(thoughts: T[], date: string) {
  return thoughts.filter((thought) => localDateKey(thought.capturedAt) === date);
}

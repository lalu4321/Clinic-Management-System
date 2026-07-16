/**
 * IST Date/Time Formatting Utilities
 *
 * All functions display times in Indian Standard Time (Asia/Kolkata, UTC+5:30).
 * Standard output format: "01 Apr 2026, 01:35 PM"
 *
 * Use these helpers everywhere a timestamp or date is shown in the UI.
 * Never render raw ISO strings or UTC times directly.
 */

const IST_TZ = "Asia/Kolkata";

// ---------------------------------------------------------------------------
// formatIST — full datetime from a UTC ISO string
// Input:  "2026-04-01T08:05:04.377071Z"
// Output: "01 Apr 2026, 01:35 PM"
// ---------------------------------------------------------------------------
export function formatIST(isoString) {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return String(isoString);

    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: IST_TZ,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(date);

    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });

    const period = (p.dayPeriod || "").toUpperCase();
    return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} ${period}`.trim();
  } catch {
    return String(isoString);
  }
}

// ---------------------------------------------------------------------------
// formatISTDate — date only from a UTC ISO string or plain "YYYY-MM-DD" string
// Input:  "2026-04-01T08:05:04.377071Z"  OR  "2026-04-01"
// Output: "01 Apr 2026"
// ---------------------------------------------------------------------------
export function formatISTDate(value) {
  if (!value) return "—";
  try {
    // Plain date string "YYYY-MM-DD" — parse as local date to avoid day-shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const [y, m, d] = String(value).split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-GB", {
      timeZone: IST_TZ,
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// formatTime12h — HH:MM or HH:MM:SS time string to 12-hour display
// Input:  "09:30:00"  or  "14:45"
// Output: "09:30 AM"  or  "02:45 PM"
// ---------------------------------------------------------------------------
export function formatTime12h(timeString) {
  if (!timeString) return "—";
  try {
    const [hStr, mStr] = String(timeString).split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (isNaN(h) || isNaN(m)) return timeString;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
  } catch {
    return String(timeString);
  }
}

// ---------------------------------------------------------------------------
// todayIST — human-readable current date for dashboard headers
// Output: "Tuesday, 01 April 2026"
// ---------------------------------------------------------------------------
export function todayIST() {
  return new Date().toLocaleDateString("en-IN", {
    timeZone: IST_TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// nowTimeIST — current time in IST for "last refreshed" indicators
// Output: "01:35 PM"
// ---------------------------------------------------------------------------
export function nowTimeIST() {
  return new Date().toLocaleTimeString("en-IN", {
    timeZone: IST_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).toUpperCase();
}

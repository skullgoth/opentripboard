/**
 * iCalendar (.ics) export utility
 * Generates RFC 5545 compliant iCalendar files from trip activities
 */

/**
 * Escape special characters per RFC 5545
 * @param {string} text
 * @returns {string}
 */
function escapeICalText(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Format a Date object to iCalendar datetime format (UTC)
 * @param {Date} date
 * @returns {string} e.g. "20250615T100000Z"
 */
function formatICalDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Fold long lines per RFC 5545 (max 75 octets per line)
 * @param {string} line
 * @returns {string}
 */
function foldLine(line) {
  const maxLen = 75;
  if (line.length <= maxLen) return line;

  let result = line.substring(0, maxLen);
  let remaining = line.substring(maxLen);

  while (remaining.length > 0) {
    const chunk = remaining.substring(0, maxLen - 1);
    result += '\r\n ' + chunk;
    remaining = remaining.substring(maxLen - 1);
  }

  return result;
}

/**
 * Generate an iCalendar (.ics) string from trip and activities data
 * @param {Object} trip - Trip object with name, destination, etc.
 * @param {Array} activities - Array of activity objects
 * @returns {string} iCalendar content
 */
export function generateICS(trip, activities) {
  const events = [];

  for (const activity of activities) {
    if (!activity.startTime && !activity.start_time) continue;

    const startTime = activity.startTime || activity.start_time;
    const endTime = activity.endTime || activity.end_time;
    const start = new Date(startTime);

    if (isNaN(start.getTime())) continue;

    let end;
    if (endTime) {
      end = new Date(endTime);
      if (isNaN(end.getTime())) {
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }
    } else {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }

    const lines = [];
    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:${activity.id}@opentripboard`));
    lines.push(`DTSTART:${formatICalDate(start)}`);
    lines.push(`DTEND:${formatICalDate(end)}`);
    lines.push(foldLine(`SUMMARY:${escapeICalText(activity.title)}`));

    if (activity.location) {
      lines.push(foldLine(`LOCATION:${escapeICalText(activity.location)}`));
    }

    if (activity.description) {
      lines.push(foldLine(`DESCRIPTION:${escapeICalText(activity.description)}`));
    }

    lines.push('END:VEVENT');
    events.push(lines.join('\r\n'));
  }

  const calendarLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OpenTripBoard//Trip Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeICalText(trip.name)}`),
    ...events,
    'END:VCALENDAR',
  ];

  return calendarLines.join('\r\n');
}

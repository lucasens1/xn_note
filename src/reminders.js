// Parse the first "@time" reminder token from a note (e.g. @8:30pm, @20:30,
// @8pm, @07:00). Returns { remindAt, label } for the next occurrence in the
// user's LOCAL timezone, or null. `now` is injectable for testing.
export function parseReminder(text, now = Date.now()) {
  if (!text) return null
  // @ + hour (+ :minutes) (+ am/pm). Word boundary after so "@8:30pmx" won't match.
  const m = text.match(/@(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?![\w:])/i)
  if (!m) return null

  let hour = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ap = m[3] ? m[3].toLowerCase() : null

  if (ap) {
    if (hour < 1 || hour > 12) return null
    if (ap === 'pm' && hour !== 12) hour += 12
    if (ap === 'am' && hour === 12) hour = 0
  }
  if (hour > 23 || min > 59) return null

  const d = new Date(now)
  d.setHours(hour, min, 0, 0)
  let remindAt = d.getTime()
  if (remindAt <= now) remindAt += 24 * 60 * 60 * 1000 // already past → tomorrow

  return { remindAt, label: formatTime(hour, min) }
}

export function formatTime(h, m) {
  const ap = h < 12 ? 'am' : 'pm'
  let hh = h % 12
  if (hh === 0) hh = 12
  return `${hh}:${String(m).padStart(2, '0')}${ap}`
}

// Count how many valid @time tokens a note contains (only the first is used).
export function countReminders(text) {
  if (!text) return 0
  const re = /@(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?![\w:])/gi
  let m
  let c = 0
  while ((m = re.exec(text))) if (parseReminder(m[0])) c++
  return c
}

// Short relative label for a reminder timestamp, e.g. "in 2h", "9:00am".
export function reminderLabel(remindAt, now = Date.now()) {
  if (!remindAt) return ''
  const d = new Date(remindAt)
  const t = formatTime(d.getHours(), d.getMinutes())
  const diff = remindAt - now
  if (diff <= 0) return `${t} · due`
  const hrs = diff / 3600000
  if (hrs < 1) return `${t} · in ${Math.max(1, Math.round(diff / 60000))}m`
  if (hrs < 24) return `${t} · in ${Math.round(hrs)}h`
  return t
}

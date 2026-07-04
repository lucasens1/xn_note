import { parseReminder } from './reminders'

// Matches @8:30pm / @20:30 / @7am — same shape the reminder parser accepts.
const RE = /@(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?![\w:])/gi

// rehype plugin: wrap valid @time tokens in the rendered preview with a styled,
// hoverable span. Only the FIRST token is the active reminder; any others are
// marked "ignored" (one reminder per note). Skips code/pre.
export default function rehypeReminders() {
  return (tree) => walk(tree, { found: false })
}

function walk(node, state) {
  if (node.type === 'element' && (node.tagName === 'code' || node.tagName === 'pre')) {
    return
  }
  if (!Array.isArray(node.children)) return
  const out = []
  for (const child of node.children) {
    if (child.type === 'text' && child.value.includes('@')) {
      out.push(...split(child.value, state))
    } else {
      walk(child, state)
      out.push(child)
    }
  }
  node.children = out
}

function split(value, state) {
  const nodes = []
  let last = 0
  let m
  RE.lastIndex = 0
  while ((m = RE.exec(value))) {
    if (!parseReminder(m[0])) continue // only real times (skip @25:00 etc.)
    if (m.index > last) nodes.push({ type: 'text', value: value.slice(last, m.index) })
    const active = !state.found
    state.found = true
    nodes.push({
      type: 'element',
      tagName: 'span',
      properties: {
        className: active ? ['reminder-token'] : ['reminder-token', 'inactive'],
        'data-tip': active
          ? 'Reminder — notifies at this time in your timezone, while the app is open.'
          : 'Ignored — only the first @time in a note is used as the reminder.',
      },
      children: [{ type: 'text', value: m[0] }],
    })
    last = m.index + m[0].length
  }
  if (nodes.length === 0) return [{ type: 'text', value }]
  if (last < value.length) nodes.push({ type: 'text', value: value.slice(last) })
  return nodes
}

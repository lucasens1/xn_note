// Notion-style "/" block menu. Each command inserts a markdown snippet and
// places the caret at `caret` (offset from the snippet start). Optional `selLen`
// selects that many characters so the user can immediately overtype a label.
export const SLASH_COMMANDS = [
  { id: 'text', label: 'Text', hint: 'Plain paragraph', icon: '¶', keys: 'text paragraph plain body', insert: '', caret: 0 },
  { id: 'h1', label: 'Heading 1', hint: '# Big title', icon: 'H1', keys: 'h1 heading title big', insert: '# ', caret: 2 },
  { id: 'h2', label: 'Heading 2', hint: '## Section', icon: 'H2', keys: 'h2 heading section subtitle', insert: '## ', caret: 3 },
  { id: 'h3', label: 'Heading 3', hint: '### Subsection', icon: 'H3', keys: 'h3 heading subsection', insert: '### ', caret: 4 },
  { id: 'bullet', label: 'Bulleted list', hint: '- item', icon: '•', keys: 'bullet list unordered ul point', insert: '- ', caret: 2 },
  { id: 'number', label: 'Numbered list', hint: '1. item', icon: '1.', keys: 'numbered ordered list ol', insert: '1. ', caret: 3 },
  { id: 'todo', label: 'To-do list', hint: '- [ ] task', icon: '☑', keys: 'todo checkbox task check done', insert: '- [ ] ', caret: 6 },
  { id: 'quote', label: 'Quote', hint: '> quote', icon: '❝', keys: 'quote blockquote cite', insert: '> ', caret: 2 },
  { id: 'code', label: 'Code block', hint: '``` fenced', icon: '</>', keys: 'code block snippet pre fenced', insert: '```\n\n```\n', caret: 4 },
  { id: 'divider', label: 'Divider', hint: '─── rule', icon: '―', keys: 'divider hr horizontal rule line separator', insert: '---\n', caret: 4 },
  { id: 'table', label: 'Table', hint: '2×2 grid', icon: '▦', keys: 'table grid rows columns', insert: '| Col 1 | Col 2 |\n| --- | --- |\n|  |  |\n', caret: 2, selLen: 5 },
  { id: 'bold', label: 'Bold', hint: '**text**', icon: 'B', keys: 'bold strong emphasis', insert: '**bold**', caret: 2, selLen: 4 },
  { id: 'italic', label: 'Italic', hint: '*text*', icon: 'I', keys: 'italic emphasis em', insert: '*italic*', caret: 1, selLen: 6 },
  { id: 'inline', label: 'Inline code', hint: '`code`', icon: '`', keys: 'inline code mono monospace', insert: '`code`', caret: 1, selLen: 4 },
  { id: 'link', label: 'Link', hint: '[text](url)', icon: '🔗', keys: 'link url href anchor', insert: '[text](url)', caret: 1, selLen: 4 },
]

export function filterSlash(query) {
  const q = (query || '').toLowerCase()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(
    (c) => c.label.toLowerCase().includes(q) || c.keys.includes(q),
  )
}

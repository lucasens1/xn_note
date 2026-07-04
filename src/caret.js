// Compute the pixel position of a caret index inside a <textarea>, using a
// mirrored div. Adapted from the well-known textarea-caret-position technique.
const PROPS = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'whiteSpace',
  'wordWrap',
]

export function getCaretCoordinates(el, position) {
  const div = document.createElement('div')
  document.body.appendChild(div)
  const style = div.style
  const computed = getComputedStyle(el)

  style.whiteSpace = 'pre-wrap'
  style.wordWrap = 'break-word'
  style.position = 'absolute'
  style.visibility = 'hidden'
  PROPS.forEach((p) => {
    try {
      style[p] = computed[p]
    } catch {
      /* some props may be read-only in a given engine */
    }
  })
  style.overflow = 'hidden'

  div.textContent = el.value.substring(0, position)
  const span = document.createElement('span')
  span.textContent = el.value.substring(position) || '.'
  div.appendChild(span)

  const coords = {
    top: span.offsetTop + parseInt(computed.borderTopWidth, 10),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth, 10),
    height: parseInt(computed.lineHeight, 10) || parseInt(computed.fontSize, 10),
  }
  document.body.removeChild(div)
  return coords
}

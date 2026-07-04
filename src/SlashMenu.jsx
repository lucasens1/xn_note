export default function SlashMenu({ items, index, coords, onSelect, onHover }) {
  const sheet = !coords
  const style = coords ? { top: coords.top, left: coords.left } : undefined
  return (
    <div
      className={'slash-menu' + (sheet ? ' sheet' : '')}
      style={style}
      // Keep the textarea focused when interacting with the menu.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="slash-head">Blocks</div>
      <div className="slash-list">
        {items.length === 0 && <div className="slash-empty">No blocks</div>}
        {items.map((it, i) => (
          <div
            key={it.id}
            className={'slash-item' + (i === index ? ' active' : '')}
            onMouseEnter={() => onHover(i)}
            onClick={() => onSelect(it)}
          >
            <span className="slash-ic">{it.icon}</span>
            <span className="slash-text">
              <span className="slash-label">{it.label}</span>
              <span className="slash-hint">{it.hint}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

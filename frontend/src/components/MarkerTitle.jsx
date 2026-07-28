// A title with a hand-drawn "highlighter swipe" behind the words — a chunky,
// slightly-rotated color block in the sticker design language. The swipe sits
// behind the text; the text rides on top. Font size/weight come from the
// caller via className on the tag.
export default function MarkerTitle({
  children,
  color = 'bg-saffron',
  rotate = '-rotate-1',
  as: Tag = 'h1',
  className = '',
}) {
  return (
    <Tag className={`relative inline-block isolate ${className}`}>
      {/* the swipe — behind the text, with a little horizontal overhang */}
      <span
        aria-hidden="true"
        className={`absolute left-[-7px] right-[-7px] top-[14%] bottom-[12%] -z-10 rounded-[3px] ${color} ${rotate}`}
      />
      <span className="relative">{children}</span>
    </Tag>
  )
}

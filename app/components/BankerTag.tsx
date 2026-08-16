/**
 * Marks a pick as that round's banker wherever picks are listed read-only —
 * kicked-off fixtures and settled results. The interactive counterpart is
 * `BankerButton`.
 */
export default function BankerTag() {
  return (
    <span
      title="Banker — points doubled"
      className="rounded-md border border-clock-line bg-clock-tint px-1.5 py-0.5 text-xs font-semibold text-clock"
    >
      <span aria-hidden="true">★</span> ×2
    </span>
  )
}

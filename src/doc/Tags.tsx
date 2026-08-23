export function Tags({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((tag) => (
        <li
          key={tag}
          className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}

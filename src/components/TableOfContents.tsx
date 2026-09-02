import type { HeadingItem } from '../markdown/headings';

interface TableOfContentsProps {
  headings: HeadingItem[];
  activeId: string | null;
  onNavigate: (id: string) => void;
}

function HeadingList({ headings, activeId, onNavigate }: TableOfContentsProps) {
  return (
    <ul>
      {headings.map((heading) => (
        <li key={heading.id}>
          <a
            href={`#${encodeURIComponent(heading.id)}`}
            aria-current={heading.id === activeId ? 'location' : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(heading.id);
            }}
          >
            <bdi dir="auto">{heading.text || 'بخش بدون عنوان'}</bdi>
          </a>
          {heading.children.length > 0 ? (
            <HeadingList headings={heading.children} activeId={activeId} onNavigate={onNavigate} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function TableOfContents(props: TableOfContentsProps) {
  if (props.headings.length === 0) return null;
  return (
    <nav aria-label="فهرست مطالب" className="table-of-contents">
      <HeadingList {...props} />
    </nav>
  );
}

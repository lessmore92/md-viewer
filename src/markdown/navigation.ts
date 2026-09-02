export function scrollToHeading(id: string, scope: ParentNode = document): void {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const target = Array.from(scope.querySelectorAll<HTMLElement>('[id]')).find(
    (element) => element.id === id,
  );
  target?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

import { vi } from 'vitest';

// jsdom does not implement modal dialogs or responsive/scroll layout.
export function installDialog() {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
}

export function installMedia({ narrow = false, reduced = false } = {}) {
  const queries = new Map<string, MediaQueryList>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      let result = queries.get(query);
      if (!result) {
        const events = new EventTarget();
        result = {
          media: query,
          matches: query.includes('max-width') ? narrow : reduced,
          onchange: null,
          addEventListener: events.addEventListener.bind(events),
          removeEventListener: events.removeEventListener.bind(events),
          dispatchEvent: events.dispatchEvent.bind(events),
          addListener: vi.fn(),
          removeListener: vi.fn(),
        };
        queries.set(query, result);
      }
      return result;
    }),
  );
  return (narrow: boolean) => {
    for (const [query, media] of queries) {
      if (query.includes('max-width')) {
        Object.defineProperty(media, 'matches', { value: narrow, configurable: true });
        media.dispatchEvent(new Event('change'));
      }
    }
  };
}

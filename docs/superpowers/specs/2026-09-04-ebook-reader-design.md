# Ebook reader mode

Add a persistent `ebook-reader` appearance alongside light and dark. A visible, labeled کتابخوان toggle selects it and returns to the previous standard theme on exit. The existing light/dark button selects the requested standard theme and leaves ebook mode. Existing dark preferences migrate without losing the user's choice, and unavailable storage never prevents switching modes.

Use an E-Ink-inspired off-white/gray screen with dark graphite text, monochrome links, syntax, alerts and displayed imagery. Retain label/icon distinctions for alerts. Book-style headings, a centered document running header and a flat reading page replace the outlined document-card treatment in this mode. Keep the outline, font size, line spacing, width, local document, scroll position and focus controls available without resetting them. There is no EPUB parsing or artificial pagination in this appearance feature.

Implementation: extend `src/app/theme.ts` with a Theme union and safe persistence helpers; coordinate appearance in App; add the toggle to Toolbar; keep mode styling isolated in `src/styles/ebook.css`, imported after the existing styles. Test switching, previous-theme restoration, migration and storage failure, then verify actual CSS, responsive behavior and offline persistence in the browser.

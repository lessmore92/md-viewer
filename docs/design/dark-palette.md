# Dark palette

The dark reader uses three levels of charcoal with a restrained blue tint: a deep workspace, quiet toolbar chrome and a slightly lighter document. Body text is softer than headings. Links and primary actions use a desaturated blue, with dark text on filled primary buttons.

| Role             | Approximate sRGB color |
| ---------------- | ---------------------- |
| Workspace        | `#121820`              |
| Toolbar          | `#171e27`              |
| Document         | `#1b222c`              |
| Raised surface   | `#242d39`              |
| Body text        | `#d5dde8`              |
| Secondary text   | `#a0adbe`              |
| Headings         | `#edf2f8`              |
| Accent           | `#8ab9f4`              |
| Selected section | `#273b54`              |
| Success          | `#96c9ab`              |
| Warning          | `#dbbf82`              |
| Error            | `#e5a0a4`              |

CSS uses OKLCH values. Markdown consumes the same semantic tokens as the application so code, tables, alerts and the outline remain consistent. Light-mode values retain their previous colors. Selection, hover, focus and control borders have explicit colors.

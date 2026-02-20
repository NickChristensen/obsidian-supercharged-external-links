# Obsidian Supercharged External Links

Style external links based on their URLs in both **reading mode** and **live preview**.

Inspired by [Supercharged Links](https://github.com/mdelobelle/obsidian_supercharged_links), which does the same for internal links.

## How it works

The plugin adds data attributes to every external link so you can target them with CSS snippets:

| Attribute | Example value |
|---|---|
| `data-href` | `https://news.ycombinator.com/item?id=123` |
| `data-href-protocol` | `https` |
| `data-href-domain` | `news.ycombinator.com` |
| `data-href-base-domain` | `ycombinator.com` |

In **reading mode**, attributes are added to the `<a>` element. In **live preview**, they are added to a wrapper span inside `.cm-link`.

## CSS snippet examples

```css
/* Icons — works in both modes */
[data-href-domain="github.com"]::before  { content: "⧉ "; }
[data-href-protocol="things"]::before    { content: "☑️ "; }
[data-href-protocol="message"]::before   { content: "✉️ "; }

/* Color — reading mode */
a[data-href-domain="github.com"] { color: var(--color-green); }

/* Color — live preview (.cm-underline needed for specificity) */
[data-href-domain="github.com"] .cm-underline { color: var(--color-green); }

/* Match all subdomains with base domain */
[data-href-base-domain="ycombinator.com"] { background: rgba(255,102,0,.15); }
```

A copy button in the plugin settings page provides a starter snippet.

## Installation

This plugin is not yet in the Obsidian community plugin directory. To install manually:

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest)
2. Copy them to `<your vault>/.obsidian/plugins/supercharged-external-links/`
3. Enable the plugin in Obsidian → Settings → Community plugins

## Development

```bash
git clone https://github.com/NickChristensen/obsidian-supercharged-external-links
cd obsidian-supercharged-external-links
npm install
```

Update `VAULT_PLUGIN_DIR` in `esbuild.config.mjs` to point to your vault, then:

```bash
npm run dev    # watch mode
npm run build  # production build
```

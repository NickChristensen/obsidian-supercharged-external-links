import {
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";

import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// ─── Settings ────────────────────────────────────────────────────────────────

interface PluginSettings {
	addDataAttributes: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
	addDataAttributes: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAttributes(
	href: string,
	settings: PluginSettings,
): Record<string, string> {
	if (!settings.addDataAttributes) return {};

	const attrs: Record<string, string> = { "data-href": href };

	// Try the full URL parser first; fall back to a regex for exotic schemes
	// like things:// or message:// that may not parse cleanly.
	try {
		const url = new URL(href);
		attrs["data-href-protocol"] = url.protocol.replace(":", "");
		if (url.hostname) {
			attrs["data-href-domain"] = url.hostname;
			const parts = url.hostname.split(".");
			if (parts.length >= 2) {
				attrs["data-href-base-domain"] = parts.slice(-2).join(".");
			}
		}
	} catch {
		const m = href.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\//);
		if (m) attrs["data-href-protocol"] = m[1].toLowerCase();
	}

	return attrs;
}

// ─── CM6 ViewPlugin (live preview) ───────────────────────────────────────────

function buildEditorExtension(getSettings: () => PluginSettings) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = this.build(view);
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.build(update.view);
				}
			}

			build(view: EditorView): DecorationSet {
				const builder = new RangeSetBuilder<Decoration>();
				const settings = getSettings();
				const tree = syntaxTree(view.state);

				for (const { from, to } of view.visibleRanges) {
					// Obsidian uses HyperMD's CM6 parser. Node names are token class
					// strings, not Lezer node names. For [text](url):
					//   "link" / "link_list-1"            → the visible link text
					//   "list-1_string_url" / "string_url" → the hidden URL
					//   "formatting_*_string_url"           → the ( ) delimiters
					//
					// Strategy: when we hit a URL token, walk back through siblings
					// to find the preceding link-text token, then decorate that range.
					tree.iterate({
						from,
						to,
						enter(node) {
							// URL nodes contain "string_url" but are NOT the formatting
							// nodes that wrap the parentheses.
							if (
								!node.name.includes("string_url") ||
								node.name.startsWith("formatting")
							) return;

							const href = view.state.doc.sliceString(node.from, node.to);
							if (!href.includes(":")) return;

							// Walk back through siblings to find the link-text node.
							// Link-text nodes contain "link" but are not formatting nodes
							// and not internal-link nodes.
							let sib = node.node.prevSibling;
							while (sib) {
								const n = sib.name;
								if (
									n.includes("link") &&
									!n.includes("formatting") &&
									!n.includes("hmd-internal-link")
								) {
									const attrs = buildAttributes(href, settings);
									if (Object.keys(attrs).length > 0) {
										builder.add(
											sib.from,
											sib.to,
											Decoration.mark({ attributes: attrs }),
										);
									}
									break;
								}
								sib = sib.prevSibling;
							}
						},
					});
				}

				return builder.finish();
			}
		},
		{ decorations: (v) => v.decorations },
	);
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default class SuperchargedExternalLinksPlugin extends Plugin {
	settings!: PluginSettings;

	async onload() {
		await this.loadSettings();

		// Live preview: CM6 ViewPlugin
		this.registerEditorExtension(buildEditorExtension(() => this.settings));

		// Reading mode: MarkdownPostProcessor
		this.registerMarkdownPostProcessor((element) => {
			for (const link of element.querySelectorAll<HTMLAnchorElement>("a.external-link")) {
				const href = link.getAttribute("href");
				if (!href) continue;
				for (const [k, v] of Object.entries(buildAttributes(href, this.settings))) {
					link.setAttribute(k, v);
				}
			}
		});

		this.addSettingTab(new SuperchargedExternalLinksSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.app.workspace.updateOptions();
	}
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

class SuperchargedExternalLinksSettingTab extends PluginSettingTab {
	plugin: SuperchargedExternalLinksPlugin;

	constructor(app: Parameters<typeof PluginSettingTab.prototype.constructor>[0], plugin: SuperchargedExternalLinksPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Add data attributes")
			.setDesc("Adds four data attributes to every external link so you can target them in CSS snippets.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.addDataAttributes).onChange(async (v) => {
					this.plugin.settings.addDataAttributes = v;
					await this.plugin.saveSettings();
				}),
			);

		const table = containerEl.createEl("table", { cls: "sel-attr-table" });
		const thead = table.createEl("thead");
		const hr = thead.createEl("tr");
		hr.createEl("th", { text: "Attribute" });
		hr.createEl("th", { text: "Example value" });
		const tbody = table.createEl("tbody");
		for (const [attr, example] of [
			["data-href",             "https://news.ycombinator.com/item?id=123"],
			["data-href-protocol",    "https"],
			["data-href-domain",      "news.ycombinator.com"],
			["data-href-base-domain", "ycombinator.com"],
		]) {
			const row = tbody.createEl("tr");
			row.createEl("td").createEl("code", { text: attr });
			row.createEl("td").createEl("code", { text: example });
		}

		const snippetLines = [
			"/* Icons — works in both modes */",
			'[data-href-domain="github.com"]::before { content: "⧉ "; }',
			'[data-href-protocol="things"]::before   { content: "☑️ "; }',
			"",
			"/* Color — reading mode */",
			'a[data-href-domain="github.com"] { color: var(--color-green); }',
			"",
			"/* Color — live preview */",
			'[data-href-domain="github.com"] .cm-underline { color: var(--color-green); }',
			"",
			"/* Match by base domain (covers all subdomains) */",
			'[data-href-base-domain="ycombinator.com"] { background: rgba(255,102,0,.15); }',
		];

		new Setting(containerEl)
			.setName("CSS snippet reference")
			.setDesc(
				"In reading mode the selector targets <a>; in live preview it targets a wrapper span inside .cm-link. " +
				"Icons (::before) and most visual properties work the same in both modes. " +
				"For color in live preview, also target .cm-underline.",
			)
			.addButton((btn) =>
				btn
					.setButtonText("Copy")
					.setTooltip("Copy snippet to clipboard")
					.onClick(() => {
						navigator.clipboard.writeText(snippetLines.join("\n"));
						btn.setButtonText("Copied!");
						setTimeout(() => btn.setButtonText("Copy"), 2000);
					}),
			);

		const help = containerEl.createEl("pre", { cls: "sel-help" });
		help.createEl("code", { text: snippetLines.join("\n") });
	}
}

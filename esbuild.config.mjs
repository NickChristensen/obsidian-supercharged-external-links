import esbuild from "esbuild";
import process from "process";
import { copyFileSync } from "fs";

const prod = process.argv[2] === "production";

const VAULT_PLUGIN_DIR =
  "/Users/nick/Library/Mobile Documents/iCloud~md~obsidian/Documents/Notes" +
  "/.obsidian/plugins/supercharged-external-links";

function copyStaticFiles() {
  copyFileSync("manifest.json", `${VAULT_PLUGIN_DIR}/manifest.json`);
  copyFileSync("styles.css",    `${VAULT_PLUGIN_DIR}/styles.css`);
}

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    "@lezer/markdown",
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: `${VAULT_PLUGIN_DIR}/main.js`,
  minify: prod,
  plugins: [{
    name: "copy-static",
    setup(build) {
      build.onEnd(() => copyStaticFiles());
    },
  }],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}

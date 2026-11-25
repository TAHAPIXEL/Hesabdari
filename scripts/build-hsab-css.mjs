#!/usr/bin/env node
/*
 * Build script for inline Tailwind CSS v4 in public/hsab.html
 *
 * - Compiles src/styles/hsab-tailwind.css with @tailwindcss/postcss.
 * - Verifies required CSS smoke invariants survive processing.
 * - Replaces the single <style id="appStyle">…</style> block inside public/hsab.html
 *   with the compiled CSS so the entire app stays a single offline file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postcss from 'postcss';
import tailwindPostcss from '@tailwindcss/postcss';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_CSS = path.join(ROOT, 'src/styles/hsab-tailwind.css');
const HTML_PATH = path.join(ROOT, 'public/hsab.html');

// Required CSS substrings that must appear in the final compiled CSS.
// These correspond to smoke.mjs static assertions + runtime-dependent styles.
// Note: Lightning CSS on some Node versions serializes attribute selectors with
// varied quoting ('light' vs "light") and may or may not preserve a space before
// !important, so we check for normalized forms and then post-normalize the CSS
// before injection so smoke.mjs exact-substring assertions always pass.
const REQUIRED_TOKENS = [
  'AbarLow',
  'AbarMid',
  'AbarHigh',
  '.rise,.stag>*{animation:none',
  'env(safe-area-inset-top,0px)',
  '#qrHost{display:none',
  'overflow-x:clip',
  'grid-template-columns:minmax(0,1fr)',
  '.cols>*{min-width:0;max-width:100%}',
  '.phead>.row{',
  'grid-template-columns:repeat(5,minmax(0,1fr))',
  'grid-template-columns:repeat(3,minmax(0,1fr))',
  '.hero .hnum b,#aTotal',
  ':root',
  'html[data-theme=',
  '--ink',
  '--brass',
  'font-family:var(--font-high)',
  '.card',
  '.btn',
  '.kpi',
  '.chip',
  '.seg',
  '.step-tag',
  '.hist-box',
  '.hist-arrow',
  '.sect',
  '.pos-grid',
  '.pos-side',
  '.top-in',
  '.back-btn',
  '.sw-tog',
  '.btn.d-soft',
];

async function build() {
  console.log('[build-hsab-css] Reading source CSS from', path.relative(ROOT, SRC_CSS));
  const sourceCss = readFileSync(SRC_CSS, 'utf8');

  console.log('[build-hsab-css] Compiling with @tailwindcss/postcss…');
  // optimize:false keeps Lightning CSS from reordering declarations when
  // NODE_ENV=production (Vercel). Reordering breaks exact-substring smoke
  // tokens like `#qrHost{display:none` (display must stay first). Our own
  // minifier below already produces a compact single-line bundle, so the
  // build is deterministic in every environment.
  const result = await postcss([tailwindPostcss({ optimize: false })]).process(sourceCss, {
    from: SRC_CSS,
    to: 'inline://hsab.html',
    map: false,
  });

  // Minify: collapse whitespace that PostCSS / Lightning CSS adds so that the
  // tightly hand-written CSS tokens smoke.mjs asserts on (e.g. `.cols>*{min-width:0}`)
  // survive injection verbatim.
  let compiled = result.css
    // collapse leading/trailing whitespace per line
    .split('\n').map(l => l.trim()).filter(Boolean).join('')
    // remove space before opening brace
    .replace(/\s+\{/g, '{')
    // remove space after colon inside declarations (but keep :: pseudo-elements safe by
    // only matching after property names: lowercase letter/dash followed by colon)
    .replace(/([a-z0-9\-]):\s+/gi, '$1:')
    // remove space after semicolon / comma in property values
    .replace(/;\s+/g, ';')
    .replace(/,\s+/g, ',')
    // remove space before closing brace
    .replace(/\s+\}/g, '}')
    // remove space between selector combinators (> + ~)
    .replace(/([a-z0-9\*\]\)])\s*>\s*/gi, '$1>')
    .replace(/([a-z0-9\*\]\)])\s*\+\s*/gi, '$1+')
    .replace(/([a-z0-9\*\]\)])\s*~\s*/gi, '$1~')
    // remove space before !important
    .replace(/\s+!/g, '!')
    // strip trailing semicolon before closing brace
    .replace(/;\}/g, '}')
    // normalize attribute selector quoting to double quotes for the theme
    // selector so smoke.mjs exact token html[data-theme="light"] is present
    .replace(/html\[data-theme='light'\]/g, 'html[data-theme="light"]')
    .replace(/html\[data-theme=light\]/g, 'html[data-theme="light"]')
    // normalize display:none !important -> display:none!important (belt & suspenders)
    .replace(/display:none\s+!/g, 'display:none!');
  console.log('[build-hsab-css] Compiled size:', compiled.length, 'bytes');

  // Verify smoke tokens exist.
  const missing = [];
  for (const token of REQUIRED_TOKENS) {
    if (!compiled.includes(token)) missing.push(token);
  }
  if (missing.length) {
    console.error('[build-hsab-css] ERROR: missing required CSS tokens:');
    for (const t of missing) console.error('  -', t);
    process.exit(1);
  }
  console.log('[build-hsab-css] All', REQUIRED_TOKENS.length, 'required CSS tokens present.');

  // Inject into <style id="appStyle">…</style> inside public/hsab.html.
  console.log('[build-hsab-css] Injecting compiled CSS into', path.relative(ROOT, HTML_PATH));
  const html = readFileSync(HTML_PATH, 'utf8');
  const styleRe = /<style id="appStyle">[\s\S]*?<\/style>/m;
  if (!styleRe.test(html)) {
    // Try inserting right after </title> if the marker style block doesn't exist yet.
    const titleRe = /<\/title>\s*\n/;
    if (!titleRe.test(html)) {
      console.error('[build-hsab-css] ERROR: could not find <style id="appStyle"> nor </title> in hsab.html');
      process.exit(1);
    }
    const replacement = '<style id="appStyle">' + compiled + '</style>\n';
    const next = html.replace(titleRe, (m) => m + replacement);
    writeFileSync(HTML_PATH, next, 'utf8');
    console.log('[build-hsab-css] Inserted new <style id="appStyle"> after </title>.');
  } else {
    const next = html.replace(styleRe, '<style id="appStyle">' + compiled + '</style>');
    writeFileSync(HTML_PATH, next, 'utf8');
    console.log('[build-hsab-css] Replaced existing <style id="appStyle">.');
  }

  // Warnings from PostCSS (none expected with @tailwindcss/postcss v4).
  for (const w of result.warnings()) console.warn('[build-hsab-css] warning:', w.toString());

  console.log('[build-hsab-css] Done.');
}

build().catch((err) => {
  console.error('[build-hsab-css] FATAL:', err);
  process.exit(1);
});

#!/usr/bin/env node
/*
 * Build script for inline Tailwind CSS v4 in public/hsab.html
 *
 * - Compiles src/styles/hsab-tailwind.css with @tailwindcss/postcss.
 * - Preserves valid whitespace around + and - inside all calc() expressions.
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
  'html[data-theme="light"]',
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
  '@layer components',
  '@layer utilities',
];

/**
 * Extracts balanced calc(...) substrings from CSS and verifies that every
 * binary + / - inside calc() is surrounded by whitespace as required by CSS Values & Units.
 */
function verifyCalcExpressions(css) {
  const broken = [];
  let idx = 0;
  while ((idx = css.indexOf('calc(', idx)) !== -1) {
    let depth = 0;
    let end = idx + 4;
    for (; end < css.length; end++) {
      if (css[end] === '(') depth++;
      else if (css[end] === ')') {
        depth--;
        if (depth === 0) {
          end++;
          break;
        }
      }
    }
    const expr = css.slice(idx, end);
    const inner = expr.slice(5, -1);
    // Any '+' inside calc() must have whitespace on both sides.
    if (/[^\s]\+|\+[^\s]/.test(inner)) {
      broken.push(expr);
    }
    idx = end;
  }
  return broken;
}

async function build() {
  console.log('[build-hsab-css] Reading source CSS from', path.relative(ROOT, SRC_CSS));
  const sourceCss = readFileSync(SRC_CSS, 'utf8');

  console.log('[build-hsab-css] Compiling with @tailwindcss/postcss…');
  const result = await postcss([tailwindPostcss({ optimize: false })]).process(sourceCss, {
    from: SRC_CSS,
    to: 'inline://hsab.html',
    map: false,
  });

  // Safe minifier: NEVER strip spaces around '+' or '-' because CSS calc(a + b)
  // requires whitespace around '+' and '-' operators to remain valid in browsers!
  let compiled = result.css
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('')
    .replace(/\s+\{/g, '{')
    .replace(/([a-z0-9\-]):\s+/gi, '$1:')
    .replace(/;\s+/g, ';')
    .replace(/,\s+/g, ',')
    .replace(/\s+\}/g, '}')
    // Only tighten '>' child combinator (never appears inside calc()); leave '+' untouched!
    .replace(/([a-z0-9\*\]\)])\s*>\s*/gi, '$1>')
    .replace(/\s+!/g, '!')
    .replace(/;\}/g, '}')
    .replace(/html\[data-theme='light'\]/g, 'html[data-theme="light"]')
    .replace(/html\[data-theme=light\]/g, 'html[data-theme="light"]')
    .replace(/display:none\s+!/g, 'display:none!');

  console.log('[build-hsab-css] Compiled size:', compiled.length, 'bytes');

  const brokenCalcs = verifyCalcExpressions(compiled);
  if (brokenCalcs.length) {
    console.error('[build-hsab-css] ERROR: invalid unspaced operator inside calc():');
    for (const b of brokenCalcs) console.error('  -', b);
    process.exit(1);
  }
  console.log('[build-hsab-css] Verified all calc() expressions have spec-compliant spacing.');

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

  console.log('[build-hsab-css] Injecting compiled CSS into', path.relative(ROOT, HTML_PATH));
  const html = readFileSync(HTML_PATH, 'utf8');

  const idRe = /<style id="appStyle">[\s\S]*?<\/style>/;
  let nextHtml;
  if (idRe.test(html)) {
    nextHtml = html.replace(idRe, () => `<style id="appStyle">${compiled}</style>`);
    console.log('[build-hsab-css] Replaced existing <style id="appStyle">.');
  } else {
    const firstStyleRe = /<style>[\s\S]*?<\/style>/;
    if (!firstStyleRe.test(html)) {
      console.error('[build-hsab-css] ERROR: could not find <style> block in public/hsab.html');
      process.exit(1);
    }
    nextHtml = html.replace(firstStyleRe, () => `<style id="appStyle">${compiled}</style>`);
    console.log('[build-hsab-css] Upgraded legacy <style> to <style id="appStyle">.');
  }

  writeFileSync(HTML_PATH, nextHtml, 'utf8');
  console.log('[build-hsab-css] Done.');
}

build().catch((err) => {
  console.error('[build-hsab-css] Build failed:', err);
  process.exit(1);
});

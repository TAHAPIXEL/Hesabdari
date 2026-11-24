import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ریشه سایت: همان فایل HTML مستقل و تک‌فایلی که در `public/hsab.html` نگهداری می‌شود.
 * این فایل بدون اینترنت و بدون سرور هم کار می‌کند (دابل-کلیک) و دوربین/داده‌ها همه محلی هستند.
 */
export function GET() {
  const html = readFileSync(join(process.cwd(), "public", "hsab.html"), "utf8");
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

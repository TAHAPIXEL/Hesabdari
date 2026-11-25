import fs from "fs";
import { JSDOM } from "jsdom";

const html = fs.readFileSync("public/hsab.html", "utf8");
const swCode = fs.readFileSync("public/sw.js", "utf8");
const manifestRaw = fs.readFileSync("public/manifest.webmanifest", "utf8");
const manifest = JSON.parse(manifestRaw);

// 1. Static asset & Android PWA verification
const requiredFiles = [
  "public/manifest.webmanifest",
  "public/favicon.ico",
  "public/icons/logo.svg",
  "public/icons/apple-touch-icon.png",
  "public/icons/icon-192.png",
  "public/icons/icon-512.png",
  "public/icons/icon-maskable-192.png",
  "public/icons/icon-maskable-512.png",
  "public/fonts/AbarLow-Regular.woff",
  "public/fonts/AbarMid-Bold.woff",
  "public/fonts/AbarHigh-Black.woff",
];
for (const f of requiredFiles) {
  if (!fs.existsSync(f) || fs.statSync(f).size === 0) {
    console.error("MISSING ASSET:", f);
    process.exit(1);
  }
}
if (
  manifest.short_name !== "نوین آشپزخانه" ||
  manifest.display !== "standalone" ||
  manifest.dir !== "rtl" ||
  !manifest.icons.some((i) => i.purpose === "maskable") ||
  !manifest.icons.some((i) => i.purpose === "any") ||
  !Array.isArray(manifest.shortcuts) ||
  manifest.shortcuts.length < 3
) {
  console.error("INVALID PWA MANIFEST");
  process.exit(1);
}
if (
  !swCode.includes("novin-cloud-sync") ||
  !swCode.includes("/manifest.webmanifest") ||
  !swCode.includes("/icons/icon-512.png") ||
  !swCode.includes("/fonts/AbarHigh-Black.woff")
) {
  console.error("SW MISSING PRECACHE OR BG SYNC");
  process.exit(1);
}

const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const w = dom.window;

const tests = [
  ["boot", "typeof S==='object' && !!draft"],
  ["novin branding at boot", "S.settings.shop==='نوین آشپزخانه' && document.getElementById('shopName').textContent==='نوین آشپزخانه' && document.title.indexOf('نوین آشپزخانه')>-1"],
  ["manifest & icons linked in head", "!!document.querySelector('link[rel=\"manifest\"]') && !!document.querySelector('link[rel=\"apple-touch-icon\"]')"],
  ["starts completely empty", "S.products.length===0 && S.invoices.length===0 && S.contacts.length===0 && S.expenses.length===0 && S.receipts.length===0"],
  ["onboarding removed", "ui.tab='home'; render(); document.getElementById('page').innerHTML.indexOf('از همین‌جا شروع کنید')===-1 && typeof onbBlock==='undefined'"],
  ["empty hero is zero", "document.querySelector('.hero .hnum b').textContent.replace(/[^0-9]/g,'').length<2"],
  ["load kitchenware demo data", "(()=>{const d=demoState(); S.products=d.products; S.contacts=d.contacts; S.invoices=d.invoices; S.expenses=d.expenses; S.receipts=d.receipts; S.seq=d.seq; S.settings.openingCash=d.settings.openingCash; draft=null; S.draft=null; render(); return S.products.length>0 && S.products[0].name.indexOf('قابلمه')>-1;})()"],
  ["sale page has history", "ui.tab='sale'; render(); document.getElementById('page').innerHTML.indexOf('سابقهٔ فاکتورها')>-1"],
  ["sale empty flow hint", "(()=>{draft.lines=[]; render(); return document.getElementById('page').innerHTML.indexOf('اسکن کنید → صفحهٔ کالا')>-1;})()"],
  ["add sheet opens", "(()=>{addSheet(S.products[0].id); const q=document.getElementById('aQty'); return !!q && document.getElementById('aTotal').textContent.length>0;})()"],
  ["qty stepper in sheet", "(()=>{document.querySelector('[data-act=aQty][data-d=\"1\"]').click(); return n(document.getElementById('aQty').value)===2;})()"],
  ["commit adds line", "(()=>{draft.lines=[]; commitAdd(true); return draft.lines.length===1 && draft.lines[0].qty===2 && document.getElementById('aDone').style.display==='block';})()"],
  ["sheet footer switches", "document.getElementById('aFoot').innerHTML.indexOf('برگشت به فاکتور')>-1"],
  ["scanNext commits then scans", "(()=>{addSheet(S.products[1].id); document.querySelector('[data-act=scanNext]').click(); const ok=draft.lines.length===2 && document.getElementById('scan').hidden===false; closeScan(); closeSheet(); return ok;})()"],
  ["three invoice actions", "(()=>{ui.tab='sale'; render(); const h=document.getElementById('page').innerHTML; return h.indexOf('ثبت فاکتور')>-1 && h.indexOf('delDraft')>-1 && h.indexOf('cancelDraft')>-1;})()"],
  ["group while typing (latin)", "(()=>{S.settings.digits='en'; const e=document.createElement('input'); document.body.appendChild(e); e.value='1234567'; e.setSelectionRange(7,7); fmtField(e); const v=e.value; e.remove(); S.settings.digits='fa'; return v==='1,234,567';})()"],
  ["group while typing (persian)", "(()=>{S.settings.digits='fa'; const e=document.createElement('input'); document.body.appendChild(e); e.value='۱۲۵۰۰۰'; e.setSelectionRange(6,6); fmtField(e); const v=e.value; e.remove(); S.settings.digits='fa'; return v==='۱۲۵٬۰۰۰';})()"],
  ["caret stays after typed digits", "(()=>{S.settings.digits='en'; const e=document.createElement('input'); document.body.appendChild(e); e.value='1234'; e.setSelectionRange(4,4); fmtField(e); const c=e.selectionStart; const v=e.value; e.remove(); S.settings.digits='fa'; return v==='1,234' && c===5;})()"],
  ["typing price updates field", "(()=>{ui.tab='stock'; ui.sub=null; ui.pq=''; ui.pf='all'; render(); productForm(null); const f=document.querySelector('#pform [name=price]'); f.value='2500000'; f.setSelectionRange(9,9); f.dispatchEvent(new Event('input',{bubbles:true})); const shown=f.value; document.querySelector('#pform [name=name]').value='کالای گران'; document.querySelector('#pform [name=stock]').value='50'; saveProduct(); const saved=S.products[0].price; return n(shown)===2500000 && shown!=='2500000' && saved===2500000;})()"],
  ["qty typed with decimal ok", "(()=>{S.settings.digits='en'; const e=document.createElement('input'); document.body.appendChild(e); e.value='12.5'; e.setSelectionRange(4,4); fmtField(e); const v=e.value; e.remove(); S.settings.digits='fa'; return v==='12.5';})()"],
  ...["home", "sale", "stock", "reports", "more"].map((t) => ["view:" + t, `ui.tab=${JSON.stringify(t)}; render(); true`]),
  ...["accounts", "expenses", "receipts", "settings"].map((t) => ["sub:" + t, `ui.tab='more'; ui.sub=${JSON.stringify(t)}; render(); true`]),
  ...["sales", "pl", "stock", "debt", "exp"].map((r) => ["report:" + r, `ui.rtab=${JSON.stringify(r)}; ui.tab='reports'; render(); true`]),
  ...["today", "7", "month", "all"].map((r) => ["range:" + r, `ui.rr=${JSON.stringify(r)}; ui.tab='reports'; render(); true`]),
  ["report purchase", "ui.rf='purchase'; render(); ui.rf='sale'; true"],
  ["product filters", "ui.pf='low'; ui.tab='stock'; render(); ui.pf='out'; render(); ui.pf='all'; render(); true"],
  ["product search", "ui.pq='قابلمه'; render(); const found=filteredProducts().length>0; ui.pq=''; render(); found"],
  ["all views no undefined", `['home','sale','stock','reports','more'].forEach(t=>{ui.tab=t;render();
      if(/undefined|NaN|object Object/.test(document.getElementById('page').innerHTML)) throw new Error('bad html in '+t);}); true`],
  ["kpis home", "ui.tab='home'; render(); document.querySelectorAll('.kpis .kpi').length>=4"],
  ["bars chart", "document.querySelectorAll('.bars>div').length===7"],
  ["hero present", "!!document.querySelector('.hero .hnum b')"],
  ["search overlay", "openSearch(); searchRender('قابلمه'); searchRender('ف-'); searchRender('البرز'); searchRender('zzz'); closeSearch(); true"],
  ["sheet product", "openProduct(S.products[0].id); document.getElementById('ov').hidden===false"],
  ["sheet form new", "closeSheet(); productForm(null); !!document.getElementById('pform')"],
  ["sheet form edit", "productForm(S.products[0].id); !!document.querySelector('#pform [name=name]').value"],
  ["saveProduct", "document.querySelector('#pform [name=name]').value='کالای تست'; document.querySelector('#pform [name=barcode]').value='999'; saveProduct(); S.products[0].name"],
  ["picker", "pickerSheet(); !!document.getElementById('picklist')"],
  ["contactForm", "closeSheet(); contactForm(); !!document.getElementById('cform')"],
  ["receiptForm", "closeSheet(); receiptForm(null); !!document.getElementById('rform')"],
  ["expenseForm", "closeSheet(); expenseForm(); !!document.getElementById('eform')"],
  ["openContact", "closeSheet(); openContact(S.contacts[0].id); true"],
  ["openInvoice", "closeSheet(); openInvoice(S.invoices[0].id); true"],
  ["closeSheet", "closeSheet(); document.getElementById('ov').hidden"],
  ["add lines", "ensureDraft(); draft.lines=[]; addToDraft(S.products[0].id); addToDraft(S.products[0].id); addToDraft(S.products[2].id); draft.lines.length===2 && draft.lines[0].qty===2"],
  ["sale view", "ui.tab='sale'; render(); document.querySelectorAll('.list .row').length>0"],
  ["totals", "draft.discount=1000; draft.vatOn=true; draft.paid=draftTotal(); (function(){const t=document.getElementById('totBox'); t.innerHTML=totalsHTML(); return draftTotal()>0})()"],
  ["posbar", "document.getElementById('posbar').className.indexOf('on')>-1 && document.getElementById('posTotal').textContent.length>0"],
  ["saveInvoice commits to history", "(()=>{if(!draft.lines.length){ensureDraft();addToDraft(S.products[0].id);} const c=S.invoices.length; saveInvoice(); return S.invoices.length===c+1 && document.getElementById('sheet').innerHTML.indexOf('فاکتور ثبت شد')>-1 && document.getElementById('sheet').innerHTML.indexOf('در سابقهٔ فاکتورها ثبت شد')>-1;})()"],
  ["cancel draft keeps history clean", "(()=>{newDraft('sale'); addToDraft(S.products[2].id); const c=S.invoices.length; document.querySelector('[data-act=cancelDraft]').click(); document.getElementById('yesBtn').click(); return S.invoices.length===c && draft.lines.length===0;})()"],
  ["del draft clears lines", "(()=>{ui.tab='sale'; newDraft('sale'); addToDraft(S.products[2].id); render(); document.querySelector('[data-act=delDraft]').click(); document.getElementById('yesBtn').click(); return draft.lines.length===0;})()"],
  ["stock moved on commit", "(()=>{newDraft('sale'); addToDraft(S.products[0].id); const pid=draft.lines[0].pid; const before=prod(pid).stock; saveInvoice(); return prod(pid).stock===before-1;})()"],
  ["invoice sheet opens", "(()=>{openInvoice(S.invoices[0].id); const ok=document.getElementById('ov').hidden===false && document.getElementById('sheet').innerHTML.indexOf('ویرایش')>-1; closeSheet(); return ok;})()"],
  ["delete invoice", "(()=>{const c=S.invoices.length; openInvoice(S.invoices[0].id); document.querySelector('[data-act=delInvoice]').click(); document.getElementById('yesBtn').click(); return S.invoices.length===c-1;})()"],
  ["print invoice shows نوین آشپزخانه + logo", "(()=>{S.settings.shop='نوین آشپزخانه'; printInvoice(S.invoices[0].id); const ph=document.getElementById('printArea').innerHTML; return ph.indexOf('p-head')>-1 && ph.indexOf('p-logo')>-1 && ph.indexOf('نوین آشپزخانه')>-1;})()"],
  ["print label shows نوین آشپزخانه", "(()=>{printLabel(S.products[0].id); const ph=document.getElementById('printArea').innerHTML; return ph.length>50 && ph.indexOf('نوین آشپزخانه')>-1;})()"],
  ["csv", "csv(reportCSV()).length>10"],
  ["settings input", "(()=>{ui.sub='settings'; ui.tab='more'; render(); const i=document.querySelector('[data-inp=\"set:shop\"]'); i.value='فروشگاه تست'; i.dispatchEvent(new Event('input',{bubbles:true})); const ok=document.getElementById('shopName').textContent==='فروشگاه تست'; i.value='نوین آشپزخانه'; i.dispatchEvent(new Event('input',{bubbles:true})); return ok && document.getElementById('shopName').textContent==='نوین آشپزخانه';})()"],
  ["digits toggle", "(()=>{let c=document.querySelector('[data-tog=digits]'); c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true})); const a=fmtNum(1234); c=document.querySelector('[data-tog=digits]'); c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true})); return a==='1,234';})()"],
  ["nav paint", "ui.tab='home'; render(); document.querySelectorAll('#tabbar .tab').length===5 && document.querySelectorAll('#rail .tab').length===6"],
  ["click delegation", "(()=>{document.querySelector('[data-act=\"nav\"][data-val=\"reports\"]').click(); return ui.tab==='reports';})()"],
  ["search result click", "openSearch(); searchRender('قابلمه'); const el=document.querySelector('#sres [data-act=pickResult]'); if(el)el.click(); 'el='+!!el+' ov='+document.getElementById('ov').hidden"],
  ["barcode lookup", "findByBarcode(S.products[0].barcode)!==null"],
  ["persian digits parse", "n('۱٬۲۵۰٫۵')===1250.5 && n('12,300')===12300"],
  ["jalali", "fmtDate('2026-03-21').indexOf('1405')===0 || fmtDate('2026-03-21').indexOf('۱۴۰۵')===0"],
  ["saveContact", "contactForm(); document.querySelector('#cform [name=name]').value='مشتری تست'; saveContact(); S.contacts.length>6"],
  ["saveExpense + edit + delete tombstone", "(()=>{expenseForm(); document.querySelector('[name=title]').value='هزینه تست'; document.querySelector('[name=amount]').value='5000'; saveExpense(); const eid=S.expenses[0].id; expenseForm(eid); document.querySelector('[name=title]').value='هزینه ویرایش‌شده'; saveExpense(); const edited=S.expenses[0].title==='هزینه ویرایش‌شده'; delExpense(eid); document.getElementById('yesBtn').click(); return edited && S._deleted.some(d=>d.entity==='expenses'&&d.id===eid);})()"],
  ["saveReceipt + edit + delete tombstone", "(()=>{receiptForm(null); document.querySelector('[name=amount]').value='1000'; saveReceipt(); const rid=S.receipts[S.receipts.length-1].id; receiptForm(null,rid); document.querySelector('[name=note]').value='یادداشت رسید'; saveReceipt(); const edited=S.receipts.find(x=>x.id===rid).note==='یادداشت رسید'; delReceipt(rid); document.getElementById('yesBtn').click(); return edited && S._deleted.some(d=>d.entity==='receipts'&&d.id===rid);})()"],
  ["empty states", "(()=>{const p=S.products.slice(); S.products=[]; ui.tab='stock'; render(); const ok=/کالایی پیدا نشد/.test(document.getElementById('page').textContent); S.products=p; render(); return ok;})()"],
  ["calc sanity", "isFinite(cashBalance()) && receivables()>=0 && payables()>=0 && stockValue()>0 && cashBalance()>0 && payables()>0"],
  ["best sellers", "bestSellers('all').length>0"],
  ["currency switch to toman", "(()=>{const p=S.products.find(x=>x.barcode==='6260001000015'); const before=p.price; setCurrency('تومان'); return cur()==='تومان' && p.price*10===before && p.price===32000;})()"],
  ["currency back to rial", "(()=>{const p=S.products.find(x=>x.barcode==='6260001000015'); setCurrency('ریال'); return cur()==='ریال' && p.price===320000;})()"],
  ["currency row in settings", "(()=>{ui.tab='more'; ui.sub='settings'; render(); const h=document.getElementById('page').innerHTML; return h.indexOf('data-act=\"setCur\"')>-1 && h.indexOf('ریال')>-1 && h.indexOf('تومان')>-1;})()"],
  ["toman survives persist + load()", "(()=>{setCurrency('تومان'); persist(); const loaded=load(); const ok=loaded.settings.currency==='تومان' && loaded.products.length===S.products.length; setCurrency('ریال'); persist(); return ok;})()"],
  ["lowStock uses p.min accurately", "(()=>{const target=S.products[0]; const oldS=target.stock, oldM=target.min; target.stock=2; target.min=5; const found=lowStock().some(x=>x.id===target.id); target.stock=oldS; target.min=oldM; return found;})()"],
  ["tombstone recorded on product delete", "(()=>{const tmpId=uid(); S.products.unshift({id:tmpId,name:'موقت',stock:1,min:0,cost:10,price:20}); delProduct(tmpId); document.getElementById('yesBtn').click(); return Array.isArray(S._deleted) && S._deleted.some(d=>d.entity==='products'&&d.id===tmpId);})()"],
  ["full JSON backup export & restore roundtrip", "(()=>{const snap=buildBackupPayload(); const jsonStr=JSON.stringify(snap); const prevP=S.products.length, prevI=S.invoices.length; S.products=[]; S.invoices=[]; importJSONObject(JSON.parse(jsonStr)); return snap.app==='نوین آشپزخانه' && snap.backupFormatVersion===3 && S.products.length===prevP && S.invoices.length===prevI && S._replaceAll===true && S._dirty===true;})()"],
  ["legacy دفتر حساب migrates to نوین آشپزخانه", "(()=>{const migrated=normalizeLoadedState({v:2,settings:{shop:'دفتر حساب',note:'از خرید شما سپاسگزاریم.'},products:[]}); return migrated.settings.shop==='نوین آشپزخانه' && migrated.settings.note.indexOf('نوین آشپزخانه')>-1;})()"],
  ["warm camera stream standby & fast resume helpers", "typeof pauseScan==='function' && typeof buildFastVideoConstraints==='function' && typeof requestAllAppPermissions==='function'"],
  ["abar optical font families configured", "(()=>{const css=[...document.querySelectorAll('style')].map(s=>s.textContent).join('\\n'); return css.includes('AbarLow') && css.includes('AbarMid') && css.includes('AbarHigh') && !css.includes(\"'Vaz'\");})()"],
  ["no app download or install UI in website", "(()=>{for(const t of ['home','sale','stock','reports','more']){go(t); if(document.querySelector('[data-act=\"installPwa\"]'))return false;} return !document.getElementById('topInstallBtn') && !document.getElementById('permInstallBtn');})()"],
  ["nav buttons stay mounted without DOM rebuild", "(()=>{go('home'); const b0=document.querySelector('#tabbar .tab'); go('sale'); go('stock'); go('reports'); go('more'); go('home'); return document.querySelector('#tabbar .tab')===b0;})()"],
  ["render diff guard prevents unnecessary DOM replacement", "(()=>{go('home'); const el0=document.getElementById('page').firstElementChild; render({preserveScroll:true}); const el1=document.getElementById('page').firstElementChild; return el0===el1 && typeof stateDataFingerprint==='function' && stateDataFingerprint(S).length>20;})()"],
  ["zero vertical jump animation on rise/stag", "(()=>{const css=[...document.querySelectorAll('style')].map(s=>s.textContent).join('\\n'); return css.includes('.rise,.stag>*{animation:none}');})()"],
  ["status bar safe area respected (not under control center)", "(()=>{const vp=document.querySelector('meta[name=\"viewport\"]').content; const sb=document.querySelector('meta[name=\"apple-mobile-web-app-status-bar-style\"]').content; const css=[...document.querySelectorAll('style')].map(s=>s.textContent).join('\\n'); return !vp.includes('viewport-fit=cover') && sb==='default' && css.includes('env(safe-area-inset-top,0px)');})()"],
  ["native Android APK JS bridge & back navigation", "(()=>{let saved=null; window.AndroidNative={saveFile:(n,t,m)=>{saved=n;return true;},shareFile:()=>true}; exportBackupJSON(); delete window.AndroidNative; go('reports'); const handled=window.__novinHandleBack(); return !!saved && saved.endsWith('.json') && handled===true && ui.tab==='home' && typeof window.__novinTriggerSync==='function';})()"],
];

const cleanTests = tests.filter((x) => Array.isArray(x) && typeof x[1] === "string");
const harness = `;(function(){
  const T=${JSON.stringify(cleanTests)};
  const out=[];
  for(let i=0;i<T.length;i++){
    const t=T[i];
    try{
      const r=eval(t[1]);
      out.push([t[0],r===false?'ASSERT':'ok',r===undefined?'':String(r)]);
    }catch(e){
      out.push([t[0],'ERR',(e&&e.message?e.message:String(e))+' #'+i]);
    }
  }
  window.__out=out;
})();`;

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
try {
  w.eval(scripts[0] + "\n" + scripts[1] + "\n" + harness);
} catch (e) {
  console.log("FATAL", e.stack);
  process.exit(1);
}
let fails = 0;
const rows = Array.isArray(w.__out) ? w.__out : [];
for (const row of rows) {
  if (!Array.isArray(row)) {
    fails++;
    console.log("BAD ROW", row);
    continue;
  }
  const [l, st, d] = row;
  if (st === "ok") console.log("ok  ", l, d === undefined ? "" : "-> " + d);
  else {
    fails++;
    console.log("FAIL", l, "->", d);
  }
}
console.log("\ntotal:", (w.__out || []).length, "failed:", fails);

// Static Android project safety checks (prevent Android 15/16 cutout crash & ensure Hamdel-style WindowInsetsCompat)
const androidResDir = "android-app/app/src/main/res";
const mainActivitySrc = fs.readFileSync(
  "android-app/app/src/main/java/ir/novinashpazkhaneh/hesabdari/MainActivity.java",
  "utf8"
);
const themesSrc = fs.readFileSync(`${androidResDir}/values/themes.xml`, "utf8");
const androidChecks = [
  ["android no values-v28/v35 cutout override crash", !fs.existsSync(`${androidResDir}/values-v28`) && !fs.existsSync(`${androidResDir}/values-v35`) && !themesSrc.includes("windowLayoutInDisplayCutoutMode")],
  ["android setContentView runs before setupSystemBars", mainActivitySrc.indexOf("setContentView(root)") > 0 && mainActivitySrc.indexOf("setContentView(root)") < mainActivitySrc.indexOf("setupSystemBars()")],
  ["android uses AndroidX WindowInsetsCompat like Hamdel", mainActivitySrc.includes("ViewCompat.setOnApplyWindowInsetsListener") && mainActivitySrc.includes("WindowInsetsCompat.Type.systemBars()") && mainActivitySrc.includes("WindowInsetsCompat.Type.displayCutout()")],
];
for (const [label, ok] of androidChecks) {
  if (ok) console.log("ok  ", label, "-> true");
  else {
    fails++;
    console.log("FAIL", label, "-> false");
  }
}

process.exit(fails ? 1 : 0);

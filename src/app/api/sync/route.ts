import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
};

const now = () => new Date().toISOString();

type Row = Record<string, unknown>;

const VALID_ENTITIES = new Set([
  "products",
  "contacts",
  "invoices",
  "expenses",
  "receipts",
]);

function parseItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** دریافت کل داده‌ها و متادیتا از دیتابیس سوپابیس */
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "supabase unconfigured" },
      { status: 503 },
    );
  }

  try {
    const [pRes, cRes, iRes, eRes, rRes, sRes, dRes] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("contacts").select("*"),
      supabase.from("invoices").select("*").order("date", { ascending: false }),
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase.from("receipts").select("*").order("date", { ascending: false }),
      supabase.from("settings").select("*"),
      supabase.from("deleted_records").select("*"),
    ]);

    const firstErr =
      pRes.error ||
      cRes.error ||
      iRes.error ||
      eRes.error ||
      rRes.error ||
      sRes.error ||
      dRes.error;

    if (firstErr) {
      return Response.json(
        { ok: false, error: firstErr.message },
        { status: 503 },
      );
    }

    const products = (pRes.data ?? []).map((r: Row) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      barcode: (r.barcode as string) ?? "",
      category: (r.category as string) ?? "",
      unit: String(r.unit ?? "عدد"),
      cost: num(r.cost),
      price: num(r.price),
      stock: num(r.stock),
      min: num(r.min_stock),
      vatable: r.vatable !== false,
      updatedAt: String(r.updated_at ?? ""),
    }));

    const contacts = (cRes.data ?? []).map((r: Row) => ({
      id: String(r.id),
      name: String(r.name ?? ""),
      kind: String(r.kind ?? "customer"),
      phone: (r.phone as string) ?? "",
      note: (r.note as string) ?? "",
      updatedAt: String(r.updated_at ?? ""),
    }));

    const invoices = (iRes.data ?? []).map((r: Row) => ({
      id: String(r.id),
      no: String(r.no ?? ""),
      kind: String(r.kind ?? "sale"),
      date: String(r.date ?? ""),
      contactId: (r.contact_id as string) ?? null,
      contactName: (r.contact_name as string) ?? "",
      items: parseItems(r.items),
      discount: num(r.discount),
      vat: num(r.vat),
      total: num(r.total),
      paid: num(r.paid),
      method: String(r.method ?? "cash"),
      note: (r.note as string) ?? "",
      updatedAt: String(r.updated_at ?? ""),
    }));

    const expenses = (eRes.data ?? []).map((r: Row) => ({
      id: String(r.id),
      date: String(r.date ?? ""),
      title: String(r.title ?? ""),
      category: (r.category as string) ?? "سایر",
      amount: num(r.amount),
      account: (r.account as string) ?? "صندوق",
      updatedAt: String(r.updated_at ?? ""),
    }));

    const receipts = (rRes.data ?? []).map((r: Row) => ({
      id: String(r.id),
      date: String(r.date ?? ""),
      contactId: (r.contact_id as string) ?? null,
      dir: String(r.dir ?? "in"),
      amount: num(r.amount),
      method: String(r.method ?? "cash"),
      note: (r.note as string) ?? "",
      updatedAt: String(r.updated_at ?? ""),
    }));

    const settingsRows = (sRes.data ?? []) as Row[];
    const appRow = settingsRows.find((r) => r.key === "app");
    const metaRow = settingsRows.find((r) => r.key === "meta");
    const meta =
      metaRow && typeof metaRow.value === "object" && metaRow.value !== null
        ? (metaRow.value as Record<string, unknown>)
        : {};

    const deleted = (dRes.data ?? []).map((r: Row) => ({
      entity: String(r.entity),
      id: String(r.record_id),
      deletedAt: String(r.deleted_at ?? ""),
    }));

    const hasData = Boolean(
      metaRow ||
        appRow ||
        products.length ||
        contacts.length ||
        invoices.length ||
        expenses.length ||
        receipts.length,
    );

    return Response.json(
      {
        ok: true,
        hasData,
        rev: num(meta.rev),
        clearedAt: (meta.clearedAt as string) ?? null,
        seq:
          meta.seq && typeof meta.seq === "object"
            ? meta.seq
            : { sale: 1001, purchase: 501 },
        settings:
          appRow && typeof appRow.value === "object" ? appRow.value : null,
        settingsUpdatedAt:
          appRow && typeof appRow.updated_at === "string"
            ? appRow.updated_at
            : null,
        products,
        contacts,
        invoices,
        expenses,
        receipts,
        deleted,
        serverTime: now(),
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 503 },
    );
  }
}

/** همگام‌سازی کامل داده‌ها با سوپابیس (upsert، حذف رکوردها، بازیابی و پاکسازی) */
export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json(
      { ok: false, error: "supabase unconfigured" },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const ts = now();
  const listOf = (k: string): Row[] =>
    Array.isArray(body[k]) ? (body[k] as Row[]) : [];

  try {
    const { data: metaExisting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "meta")
      .maybeSingle();

    const prevMeta =
      metaExisting?.value && typeof metaExisting.value === "object"
        ? (metaExisting.value as Record<string, unknown>)
        : {};
    const nextRev = Math.max(num(prevMeta.rev), num(body.rev)) + 1;

    // ۱. پاکسازی کامل دیتابیس در صورت زدن «پاک‌سازی کامل»
    if (body.clearAll === true) {
      await Promise.all([
        supabase.from("products").delete().neq("id", ""),
        supabase.from("contacts").delete().neq("id", ""),
        supabase.from("invoices").delete().neq("id", ""),
        supabase.from("expenses").delete().neq("id", ""),
        supabase.from("receipts").delete().neq("id", ""),
        supabase.from("ledger_entries").delete().neq("id", ""),
        supabase.from("deleted_records").delete().neq("entity", ""),
      ]);

      const settingsPayload: Row[] = [
        {
          key: "meta",
          value: {
            rev: nextRev,
            seq: { sale: 1001, purchase: 501 },
            clearedAt: ts,
            updatedAt: ts,
          },
          updated_at: ts,
        },
      ];
      if (body.settings && typeof body.settings === "object") {
        settingsPayload.push({
          key: "app",
          value: body.settings,
          updated_at: ts,
        });
      }
      const { error: setErr } = await supabase
        .from("settings")
        .upsert(settingsPayload, { onConflict: "key" });
      if (setErr) throw new Error(setErr.message);

      return Response.json({ ok: true, rev: nextRev, at: ts, clearedAt: ts });
    }

    // ۲. اعمال حذف‌های ثبت‌شده (Tombstones)
    const deletedList = listOf("deleted").filter(
      (d) =>
        typeof d.entity === "string" &&
        VALID_ENTITIES.has(d.entity) &&
        typeof d.id === "string" &&
        d.id.length > 0,
    );

    if (deletedList.length > 0) {
      const byEntity: Record<string, string[]> = {};
      for (const d of deletedList) {
        const entity = String(d.entity);
        const id = String(d.id);
        if (!byEntity[entity]) byEntity[entity] = [];
        byEntity[entity].push(id);
      }

      await Promise.all(
        Object.entries(byEntity).map(([entity, ids]) =>
          supabase.from(entity).delete().in("id", ids),
        ),
      );

      await supabase.from("deleted_records").upsert(
        deletedList.map((d) => ({
          entity: String(d.entity),
          record_id: String(d.id),
          deleted_at: String(d.deletedAt ?? ts),
        })),
        { onConflict: "entity,record_id" },
      );
    }

    // ۳. اگر بازیابی فایل پشتیبان (replaceAll) انجام شده، رکوردهای اضافی سرور پاک شوند
    if (body.replaceAll === true) {
      const tables = [
        "products",
        "contacts",
        "invoices",
        "expenses",
        "receipts",
      ] as const;
      for (const tbl of tables) {
        const incomingIds = new Set(
          listOf(tbl)
            .map((r) => String(r.id ?? ""))
            .filter(Boolean),
        );
        const { data: existingRows } = await supabase.from(tbl).select("id");
        const toRemove = (existingRows ?? [])
          .map((r: Row) => String(r.id))
          .filter((id) => !incomingIds.has(id));
        if (toRemove.length > 0) {
          await supabase.from(tbl).delete().in("id", toRemove);
        }
      }
      await supabase.from("deleted_records").delete().neq("entity", "");
    }

    // ۴. آماده‌سازی و ذخیره دسته‌ای (Upsert) تمام موجودیت‌ها
    const productRows = listOf("products")
      .filter((r) => r.id)
      .map((r) => ({
        id: String(r.id),
        name: String(r.name ?? ""),
        barcode: r.barcode ? String(r.barcode) : null,
        category: r.category ? String(r.category) : null,
        unit: String(r.unit ?? "عدد"),
        cost: num(r.cost),
        price: num(r.price),
        stock: num(r.stock),
        min_stock: num(r.min ?? r.minStock),
        vatable: r.vatable !== false,
        updated_at: String(r.updatedAt || ts),
      }));

    const contactRows = listOf("contacts")
      .filter((r) => r.id)
      .map((r) => ({
        id: String(r.id),
        name: String(r.name ?? ""),
        kind: String(r.kind ?? "customer"),
        phone: r.phone ? String(r.phone) : null,
        note: r.note ? String(r.note) : null,
        updated_at: String(r.updatedAt || ts),
      }));

    const invoiceRows = listOf("invoices")
      .filter((r) => r.id)
      .map((r) => ({
        id: String(r.id),
        no: String(r.no ?? ""),
        kind: String(r.kind ?? "sale"),
        date: String(r.date ?? ts.slice(0, 10)),
        contact_id: r.contactId ? String(r.contactId) : null,
        contact_name: r.contactName ? String(r.contactName) : null,
        items: parseItems(r.items),
        discount: num(r.discount),
        vat: num(r.vat),
        total: num(r.total),
        paid: num(r.paid),
        method: String(r.method ?? "cash"),
        note: r.note ? String(r.note) : null,
        updated_at: String(r.updatedAt || ts),
      }));

    const expenseRows = listOf("expenses")
      .filter((r) => r.id)
      .map((r) => ({
        id: String(r.id),
        date: String(r.date ?? ts.slice(0, 10)),
        title: String(r.title ?? ""),
        category: r.category ? String(r.category) : null,
        amount: num(r.amount),
        account: r.account ? String(r.account) : null,
        updated_at: String(r.updatedAt || ts),
      }));

    const receiptRows = listOf("receipts")
      .filter((r) => r.id)
      .map((r) => ({
        id: String(r.id),
        date: String(r.date ?? ts.slice(0, 10)),
        contact_id: r.contactId ? String(r.contactId) : null,
        dir: String(r.dir ?? "in"),
        amount: num(r.amount),
        method: String(r.method ?? "cash"),
        note: r.note ? String(r.note) : null,
        updated_at: String(r.updatedAt || ts),
      }));

    const upsertOps = [];
    if (productRows.length > 0) {
      upsertOps.push(
        supabase.from("products").upsert(productRows, { onConflict: "id" }),
      );
    }
    if (contactRows.length > 0) {
      upsertOps.push(
        supabase.from("contacts").upsert(contactRows, { onConflict: "id" }),
      );
    }
    if (invoiceRows.length > 0) {
      upsertOps.push(
        supabase.from("invoices").upsert(invoiceRows, { onConflict: "id" }),
      );
    }
    if (expenseRows.length > 0) {
      upsertOps.push(
        supabase.from("expenses").upsert(expenseRows, { onConflict: "id" }),
      );
    }
    if (receiptRows.length > 0) {
      upsertOps.push(
        supabase.from("receipts").upsert(receiptRows, { onConflict: "id" }),
      );
    }

    const results = await Promise.all(upsertOps);
    for (const res of results) {
      if (res.error) throw new Error(res.error.message);
    }

    // ۵. ذخیره تنظیمات و شمارنده فاکتورها (seq) و نسخه (rev)
    const prevSeq =
      prevMeta.seq && typeof prevMeta.seq === "object"
        ? (prevMeta.seq as Record<string, unknown>)
        : {};
    const inSeq =
      body.seq && typeof body.seq === "object"
        ? (body.seq as Record<string, unknown>)
        : {};
    const mergedSeq = {
      sale: Math.max(1001, num(prevSeq.sale), num(inSeq.sale)),
      purchase: Math.max(501, num(prevSeq.purchase), num(inSeq.purchase)),
    };

    const settingsPayload: Row[] = [
      {
        key: "meta",
        value: {
          rev: nextRev,
          seq: mergedSeq,
          clearedAt: (prevMeta.clearedAt as string) ?? null,
          updatedAt: ts,
        },
        updated_at: ts,
      },
    ];

    if (body.settings && typeof body.settings === "object") {
      settingsPayload.push({
        key: "app",
        value: body.settings,
        updated_at: ts,
      });
    }

    const { error: settingsErr } = await supabase
      .from("settings")
      .upsert(settingsPayload, { onConflict: "key" });
    if (settingsErr) throw new Error(settingsErr.message);

    return Response.json({
      ok: true,
      rev: nextRev,
      seq: mergedSeq,
      at: ts,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}

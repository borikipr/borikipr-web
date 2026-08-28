import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  PUERTO_RICO_TIME_ZONE,
  formatPuertoRicoDate,
  formatPuertoRicoDateTimeShort,
} from "../lib/puerto-rico-time.ts";

const root = process.cwd();
const source = (file) => readFile(path.join(root, file), "utf8");

test("Puerto Rico display formatting is explicit and stable across runtime time zones", () => {
  const instant = "2026-03-08T06:30:00.000Z";
  const originalTimeZone = process.env.TZ;

  try {
    process.env.TZ = "UTC";
    const fromServer = {
      date: formatPuertoRicoDate(instant),
      dateTime: formatPuertoRicoDateTimeShort(instant),
    };

    process.env.TZ = "Asia/Tokyo";
    const fromBrowser = {
      date: formatPuertoRicoDate(instant),
      dateTime: formatPuertoRicoDateTimeShort(instant),
    };

    assert.equal(PUERTO_RICO_TIME_ZONE, "America/Puerto_Rico");
    assert.deepEqual(fromBrowser, fromServer);
    assert.equal(
      fromServer.dateTime,
      new Intl.DateTimeFormat("es-PR", {
        timeZone: "America/Puerto_Rico",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(instant)),
    );
  } finally {
    process.env.TZ = originalTimeZone;
  }
});

test("shared Admin shell provides a skip target and consistent navigation semantics", async () => {
  const [layout, navigation, shell, actions] = await Promise.all([
    source("app/admin/layout.tsx"),
    source("components/admin/AdminNav.tsx"),
    source("components/admin/AdminPageShell.tsx"),
    source("components/admin/AdminActionsMenu.tsx"),
  ]);

  assert.match(layout, /Saltar al contenido principal/);
  assert.match(layout, /id="admin-content"/);
  assert.match(navigation, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(navigation, /aria-modal="true"/);
  assert.match(shell, /aria-label="Breadcrumb"/);
  assert.match(shell, /aria-hidden="true" className="text-\[#b5b5b5\]"/);
  assert.match(actions, /role="menu"/);
  assert.match(actions, /onKeyDown/);
});

test("operational surfaces use the shared Puerto Rico formatter instead of runtime defaults", async () => {
  const [overview, ga4, clarity, vercel, governance, publicOpenHouse] = await Promise.all([
    source("app/admin/analytics/page.tsx"),
    source("app/admin/analytics/ga4/page.tsx"),
    source("app/admin/analytics/clarity/page.tsx"),
    source("app/admin/analytics/vercel/page.tsx"),
    source("app/admin/signatures/gobernanza/page.tsx"),
    source("app/(public)/listados/[slug]/registro-openhouse/page.tsx"),
  ]);

  for (const page of [overview, ga4, clarity, vercel]) {
    assert.match(page, /formatPuertoRicoDateTimeShort/);
  }
  assert.match(governance, /formatPuertoRicoDateTimeShort/);
  assert.match(governance, /formatPuertoRicoDate\(row\.effective_from\)/);
  assert.match(publicOpenHouse, /timeZone: "America\/Puerto_Rico"/);
});

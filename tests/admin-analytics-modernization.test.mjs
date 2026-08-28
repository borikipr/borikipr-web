import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("analytics overview prioritizes business context over provider dashboards", async () => {
  const source = await read("app/admin/analytics/page.tsx");
  assert.match(source, /Rendimiento del website/);
  assert.match(source, /analytics-subnav/);
  assert.match(source, /Tráfico y conversión/);
  assert.match(source, /Salud técnica/);
  assert.match(source, /analytics-kpi-grid/);
});

test("analytics preserves provider data and uses compact presentation surfaces", async () => {
  const [source, dashboard] = await Promise.all([read("app/admin/analytics/page.tsx"), read("lib/admin/analytics/dashboard.ts")]);
  assert.match(source, /getAdminAnalyticsDashboard\(currentRange\)/);
  assert.match(source, /AnalyticsRefreshControls/);
  assert.match(dashboard, /Promise\.all/);
  assert.match(dashboard, /getProviderDashboardData/);
});

test("analytics mobile styles avoid a single long KPI column", async () => {
  const source = await read("app/globals.css");
  assert.match(source, /\.analytics-kpi-grid/);
  assert.match(source, /@media\(max-width:639px\)/);
  assert.match(source, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

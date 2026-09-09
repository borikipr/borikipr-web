import { BetaAnalyticsDataClient } from "@google-analytics/data";
import {
  createGa4WifAuthClient,
  getGa4WifConfig,
} from "../../lib/admin/analytics/providers/ga4-auth";

async function main() {
  if (process.env.GA4_WIF_BUILD_CANARY !== "1") {
    console.log("[ga4-wif-canary] Skipped.");
    return;
  }

  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const config = getGa4WifConfig();

  if (!propertyId || !config) {
    throw new Error("GA4 WIF build canary configuration is incomplete.");
  }

  const client = new BetaAnalyticsDataClient({
    authClient: createGa4WifAuthClient(config),
    projectId: config.projectId,
  });

  await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
    metrics: [{ name: "totalUsers" }],
    limit: 1,
  });

  console.log(
    "[ga4-wif-canary] Short-lived authentication and GA4 read succeeded."
  );
}

void main();

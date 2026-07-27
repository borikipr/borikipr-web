"use client";

import Script from "next/script";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { shouldExcludeAnalyticsPath } from "@/lib/analytics-routes";

const isProduction = process.env.NODE_ENV === "production";
const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

export default function AnalyticsScripts() {
  const pathname = usePathname();
  const excludeAnalytics = shouldExcludeAnalyticsPath(pathname);

  useEffect(() => {
    if (!gaMeasurementId || typeof window === "undefined") return;

    window[`ga-disable-${gaMeasurementId}`] = excludeAnalytics;
  }, [excludeAnalytics]);

  if (!isProduction) {
    return null;
  }

  return (
    <>
      {gaMeasurementId && !excludeAnalytics && <GoogleAnalytics gaId={gaMeasurementId} />}

      {clarityProjectId && !excludeAnalytics && (
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityProjectId}");
          `}
        </Script>
      )}

      <VercelAnalytics
        beforeSend={(event) =>
          shouldExcludeAnalyticsPath("url" in event ? event.url : pathname)
            ? null
            : event
        }
      />
    </>
  );
}

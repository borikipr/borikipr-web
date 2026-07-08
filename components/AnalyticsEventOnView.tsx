"use client";

import { useEffect } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";

type Props = {
  eventName: string;
  params?: Record<string, string | number | boolean | null | undefined>;
};

export default function AnalyticsEventOnView({ eventName, params = {} }: Props) {
  useEffect(() => {
    trackAnalyticsEvent(eventName, params);
  }, [eventName, params]);

  return null;
}

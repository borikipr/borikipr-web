"use client";

import Link from "next/link";
import type { LinkProps } from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";

type Props = LinkProps & {
  className?: string;
  target?: string;
  rel?: string;
  "aria-label"?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  eventName: string;
  eventParams?: Record<string, string | number | boolean | null | undefined>;
  children: ReactNode;
};

export default function AnalyticsLink({
  eventName,
  eventParams,
  onClick,
  children,
  ...props
}: Props) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        trackAnalyticsEvent(eventName, eventParams);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}

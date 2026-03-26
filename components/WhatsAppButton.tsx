"use client";

import Link from "next/link";

export default function WhatsAppButton() {
  return (
    <Link
      href="https://wa.me/17876774900"
      target="_blank"
      aria-label="Escribir por WhatsApp"
      className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-3 rounded-full bg-[#11518b] px-5 py-3 text-white shadow-lg transition hover:bg-[#0d406d] hover:shadow-xl"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path d="M19.11 17.21c-.29-.14-1.7-.84-1.97-.94-.26-.1-.45-.14-.64.14-.19.29-.74.94-.91 1.13-.17.19-.34.22-.63.07-.29-.14-1.21-.45-2.31-1.43-.85-.76-1.43-1.7-1.59-1.99-.17-.29-.02-.44.12-.58.13-.13.29-.34.43-.51.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.14-.64-1.54-.88-2.11-.23-.55-.47-.47-.64-.48l-.55-.01c-.19 0-.48.07-.74.36-.26.29-.98.96-.98 2.34 0 1.38 1 2.71 1.14 2.9.14.19 1.96 3 4.75 4.2.66.29 1.18.46 1.58.59.66.21 1.27.18 1.75.11.53-.08 1.7-.69 1.94-1.35.24-.66.24-1.22.17-1.35-.07-.12-.26-.19-.55-.33Z" />
          <path d="M16.02 3.2c-6.99 0-12.66 5.66-12.66 12.64 0 2.22.58 4.39 1.68 6.31L3.2 28.8l6.82-1.79a12.66 12.66 0 0 0 6 1.53h.01c6.98 0 12.65-5.66 12.65-12.64S23 3.2 16.02 3.2Zm0 23.17h-.01a10.5 10.5 0 0 1-5.36-1.47l-.38-.22-4.05 1.06 1.08-3.95-.24-.4a10.48 10.48 0 0 1-1.61-5.5c0-5.8 4.73-10.52 10.56-10.52 2.82 0 5.47 1.09 7.46 3.08a10.43 10.43 0 0 1 3.09 7.45c0 5.8-4.74 10.52-10.54 10.52Z" />
        </svg>
      </span>

      <span className="hidden sm:inline text-sm font-semibold">
        WhatsApp
      </span>
    </Link>
  );
}
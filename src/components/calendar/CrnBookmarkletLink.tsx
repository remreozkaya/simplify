"use client";

import React from "react";

type Props = { url: string | null; label: string; tooltip: string };

export default function CrnBookmarkletLink({ url, label, tooltip }: Props) {
  return (
    <a
      // React rejects javascript: href props. This intentional bookmark URL is
      // installed on the native anchor; all clicks still prevent navigation.
      ref={(anchor) => {
        if (!anchor) return;
        if (url) anchor.setAttribute("href", url);
        else anchor.removeAttribute("href");
      }}
      draggable={Boolean(url)}
      aria-disabled={!url}
      role="link"
      tabIndex={url ? 0 : -1}
      title={tooltip}
      data-label={label}
      aria-label={`${label}: ${tooltip}`}
      onClick={(event) => event.preventDefault()}
      onAuxClick={(event) => event.preventDefault()}
      onDragStart={(event) => {
        if (!url) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "copyLink";
        // Replacing a native URL item discards Chrome's bookmark title.
        if (event.dataTransfer.getData("text/uri-list") !== url) {
          event.dataTransfer.setData("text/uri-list", url);
        }
        event.dataTransfer.setData("text/plain", url);
        event.dataTransfer.setData("text/html", event.currentTarget.outerHTML);
      }}
      className={`relative rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm font-semibold text-blue-700 shadow-sm transition-colors duration-200 after:content-[attr(data-label)] focus-visible:outline-2 focus-visible:outline-blue-500 ${url ? "cursor-grab hover:bg-blue-100 active:cursor-grabbing" : "cursor-not-allowed opacity-50"}`}
    >
      {/* Native link drags use textContent for the saved title. */}
      <span className="sr-only" aria-hidden="true">CRN Doldur</span>
    </a>
  );
}

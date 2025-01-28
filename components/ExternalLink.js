import React from "react";

export default function ExternalLink({ href, className, children }) {
  return (
    <a
      className={`cursor-pointer ${className}`}
      onClick={() => requestOpenUrl(href)}
    >
      {children}
    </a>
  );
}

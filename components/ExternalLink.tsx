import React from "react";

export default function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      className={`cursor-pointer ${className}`}
      onClick={() => requestOpenUrl(href)}
    >
      {children}
    </a>
  );
}

/* global requestOpenUrl */

import React from "react";

export default function ExternalLink({ href, children }) {
  return <a onClick={() => requestOpenUrl(href)}>{children}</a>;
}

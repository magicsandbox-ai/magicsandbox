import React from "react";

/*
- published apps
- favorited apps
- recent apps
*/

export default function Home() {
  return <div>Home</div>;
}

function AppCard({ app }) {
  /*
  - id, description, icon for deprecated
  - expand to see minCost, finalCost, deprecated explained
  - expand to edit and pin a version? link to homepage?
  */
  return <div>{app.name}</div>;
}

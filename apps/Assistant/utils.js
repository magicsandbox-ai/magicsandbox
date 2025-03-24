const dollarFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

function formatAsDollars(amount) {
  return dollarFormatter.format(amount);
}

async function getMinCost(app) {
  const metadata = await requestMetadata(app, ["minCost"], {
    kind: "app",
  });
  if (metadata.length !== 1) {
    throw new Error("Invalid metadata with length " + metadata.length);
  }
  return metadata[0].minCost;
}

export { formatAsDollars, getMinCost };

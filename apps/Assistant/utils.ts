const dollarFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

function formatAsDollars(amount: number) {
  return dollarFormatter.format(amount);
}

export { formatAsDollars };

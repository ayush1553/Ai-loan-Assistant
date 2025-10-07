const offers = [
  { tenureMonths: 6, interestRate: 10.5 },
  { tenureMonths: 12, interestRate: 11.0 },
  { tenureMonths: 18, interestRate: 11.5 },
  { tenureMonths: 24, interestRate: 12.0 },
  { tenureMonths: 36, interestRate: 12.5 }
];

export function getOfferForTenure(tenureMonths) {
  return offers.find((o) => o.tenureMonths === Number(tenureMonths)) || offers[1];
}

export { offers };



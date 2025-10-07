import { getCustomerById } from '../../store/customers.js';
import { getOfferForTenure } from '../../store/offers.js';

export async function underwritingAgent(context) {
  const { verification, tenureMonths, loanAmount, documents } = context;
  const customer = verification?.customerId ? getCustomerById(verification.customerId) : null;
  const preApproved = 100000; // universal approval limit as requested
  const offer = getOfferForTenure(tenureMonths);

  const decision = decideAmountOnly(loanAmount, preApproved, documents);

  return {
    decision: decision.type,
    preApprovedLimit: preApproved,
    approvedAmount: decision.type === 'approved' ? loanAmount : 0,
    interestRate: offer?.interestRate ?? 12,
    reason: decision.reason
  };
}

function decideAmountOnly(amount, preApproved, documents) {
  if (amount <= preApproved) return { type: 'approved' };
  if (amount <= 2 * preApproved) {
    if (documents?.salarySlip) return { type: 'approved' };
    return { type: 'pending', reason: 'requires salary slip' };
  }
  return { type: 'rejected', reason: 'amount exceeds 2x approval limit' };
}




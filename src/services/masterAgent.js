import { salesAgent } from './workers/salesAgent.js';
import { verificationAgent } from './workers/verificationAgent.js';
import { underwritingAgent } from './workers/underwritingAgent.js';
import { sanctionLetterAgent } from './workers/sanctionLetterAgent.js';
import { customers } from '../store/customers.js';

export async function runMasterAgent(message, context) {
  const ctx = normalizeContext(context);
  const logs = [];

  // Decide next step based on context completeness
  const steps = [];

  // 1) Sales capture
  if (!ctx.loanAmount || !ctx.tenureMonths || !ctx.purpose) {
    logs.push('Master→Sales: capture loan details');
    const s = await salesAgent(message, ctx);
    steps.push({ salesResponse: s.response });
    Object.assign(ctx, s.updatedContext);
    // If still missing info, ask again. Otherwise, fall through to next steps in same turn.
    if (!ctx.loanAmount || !ctx.tenureMonths || !ctx.purpose) {
      logs.push('Sales: awaiting more details');
      return buildResponse(ctx, steps, logs);
    }
  }

  // 2) Verification
  if (!ctx.verification || ctx.verification.status !== 'verified') {
    logs.push('Master→Verification: verify identity');
    // Try to parse KYC from the current message if any of the fields are missing
    if (!ctx.name || !ctx.city || !ctx.phone) {
      const kyc = parseKycFromMessage(message);
      if (kyc.name && !ctx.name) ctx.name = kyc.name;
      if (kyc.city && !ctx.city) ctx.city = kyc.city;
      if (kyc.phone && !ctx.phone) ctx.phone = kyc.phone;
    }
    const v = await verificationAgent(ctx);
    steps.push({ verificationResult: v });
    ctx.verification = v;
    if (v.status !== 'verified') {
      logs.push('Verification: needs input');
      return buildResponse(ctx, steps, logs);
    }
  }

  // 3) Underwriting
  // If user uploaded slip, clear prior pending decision to re-evaluate
  if (/uploaded\s+slip/i.test(String(message)) && ctx.underwriting?.decision === 'pending') {
    ctx.documents = { ...(ctx.documents || {}), salarySlip: true };
    ctx.underwriting = undefined;
    logs.push('Master: salary slip received, re-evaluating underwriting');
  }

  if (!ctx.underwriting) {
    logs.push('Master→Underwriting: evaluate eligibility');
    const u = await underwritingAgent(ctx);
    steps.push({ underwritingDecision: u });
    ctx.underwriting = u;

    if (u.decision !== 'approved') {
      logs.push(`Underwriting: decision=${u.decision}`);
      return buildResponse(ctx, steps, logs);
    }
  }

  // 4) Sanction letter if approved
  if (ctx.underwriting?.decision === 'approved' && !ctx.sanction) {
    logs.push('Master→Sanction: generate letter');
    const sL = await sanctionLetterAgent(ctx);
    steps.push({ sanctionLetterLink: sL.link });
    ctx.sanction = sL;
  }

  return buildResponse(ctx, steps, logs);
}

function normalizeContext(context) {
  const c = { ...context };
  c.name = c.name || '';
  c.city = c.city || '';
  c.phone = c.phone || '';
  c.loanAmount = toNumber(c.loanAmount);
  c.tenureMonths = toNumber(c.tenureMonths);
  c.purpose = c.purpose || '';
  return c;
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function buildResponse(ctx, steps, logs = []) {
  const latest = steps[steps.length - 1] || {};
  const messageParts = [];

  if (latest.salesResponse) messageParts.push(latest.salesResponse);
  if (latest.verificationResult) {
    const v = latest.verificationResult;
    if (v.status === 'verified') {
      messageParts.push(`✅ Verified for ${v.name}, ${v.city}.`);
    } else {
      messageParts.push('Could not verify details. Please re-enter name, phone, and city.');
    }
  }
  if (latest.underwritingDecision) {
    const u = latest.underwritingDecision;
    if (u.decision === 'approved') {
      messageParts.push(`✅ Approved. Amount ₹${formatAmount(u.approvedAmount)} at ${u.interestRate}% for ${ctx.tenureMonths} months.`);
      messageParts.push('Generating your sanction letter...');
    } else if (u.decision === 'pending') {
      messageParts.push(`⏳ Pending. Please upload your latest salary slip to proceed.`);
    } else {
      messageParts.push(`❌ Rejected. Reason: ${u.reason}.`);
    }
  }
  if (latest.sanctionLetterLink) {
    messageParts.push(`Sanction letter ready: ${latest.sanctionLetterLink}`);
  }

  return {
    message: messageParts.join(' '),
    context: ctx,
    logs,
    ...Object.assign({}, ...steps)
  };
}

function formatAmount(n) {
  return new Intl.NumberFormat('en-IN').format(Number(n || 0));
}

function parseKycFromMessage(message) {
  const result = { name: '', city: '', phone: '' };
  const text = String(message || '').trim();
  if (!text) return result;
  // phone
  const digits = text.replace(/\D/g, '');
  const phoneMatch = digits.match(/(\d{10})(\d+)?$/);
  if (phoneMatch) result.phone = phoneMatch[1];

  // city from known list
  const cityList = Array.from(new Set(customers.map(c => c.city)));
  const lower = text.toLowerCase();
  for (const city of cityList) {
    if (lower.includes(city.toLowerCase())) { result.city = city; break; }
  }

  // name: first comma-separated token that looks like a full name
  const parts = text.split(/[,|]/).map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const looksLikePhone = /\d{6,}/.test(part);
    const looksLikeCity = result.city && part.toLowerCase().includes(result.city.toLowerCase());
    if (!looksLikePhone && !looksLikeCity && /[a-zA-Z]{2,}\s+[a-zA-Z]{2,}/.test(part)) {
      result.name = part;
      break;
    }
  }

  return result;
}



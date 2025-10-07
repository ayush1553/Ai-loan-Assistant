import { customers } from '../../store/customers.js';

export async function salesAgent(message, context) {
  const updated = { ...context };

  // Try to parse amount and tenure from message
  if (!updated.loanAmount) {
    const amtMatch = String(message).match(/(?:₹|rs\.?|\$)?\s*([\d,.]{3,})(?:\s*(k|thousand|lakh|lakhs|million|m))?/i);
    if (amtMatch) {
      let base = Number(amtMatch[1].replace(/[,]/g, ''));
      const scale = (amtMatch[2] || '').toLowerCase();
      if (Number.isFinite(base)) {
        if (scale === 'k' || scale === 'thousand') base *= 1000;
        if (scale === 'lakh' || scale === 'lakhs') base *= 100000;
        if (scale === 'm' || scale === 'million') base *= 1000000;
        updated.loanAmount = Math.round(base);
      }
    }
  }
  if (!updated.tenureMonths) {
    const tenureMatch = String(message).match(/(\d{1,2})\s*(?:months?|mos?)/i);
    if (tenureMatch) {
      updated.tenureMonths = Number(tenureMatch[1]);
    }
  }
  if (!updated.purpose) {
    const purpose = extractPurpose(String(message));
    if (purpose) updated.purpose = purpose;
  }

  // Try to parse KYC if missing (name, city, phone) from free text like
  // "Ayush Prajapati, Varanasi, 9876543210" in any order
  if (!updated.name || !updated.city || !updated.phone) {
    const kyc = extractKyc(String(message));
    if (kyc.name && !updated.name) updated.name = kyc.name;
    if (kyc.city && !updated.city) updated.city = kyc.city;
    if (kyc.phone && !updated.phone) updated.phone = kyc.phone;
  }

  let response;
  if (!updated.loanAmount || !updated.tenureMonths) {
    response = 'Sure! Please tell me your desired amount and tenure.';
  } else if (!updated.purpose) {
    response = 'Great! What is the purpose of the loan?';
  } else if (!updated.name || !updated.city || !updated.phone) {
    response = 'Please share your full name, city, and 10-digit phone (e.g., Ayush Prajapati, Varanasi, 9876543210).';
  } else {
    response = `Thanks! Captured ₹${new Intl.NumberFormat('en-IN').format(updated.loanAmount)} for ${updated.tenureMonths} months${updated.purpose ? `, purpose: ${updated.purpose}` : ''}. Proceeding to KYC verification.`;
  }

  return { response, updatedContext: updated };
}

function extractPurpose(message) {
  const text = message.toLowerCase();
  const purposes = [
    'education', 'study', 'college', 'university', 'tuition', 'fees',
    'medical', 'home renovation', 'renovation', 'travel', 'debt consolidation', 'wedding', 'business', 'electronics'
  ];
  const commonMisspellings = [
    'eduction', 'sducation', 'educatoin', 'educaton', 'studdy', 'medcal', 'travell', 'bussiness'
  ];

  // direct includes
  for (const p of purposes) {
    if (text.includes(p)) return p;
  }
  // Handle phrases like "for education"
  const forMatch = text.match(/for\s+([a-z ,]{3,60})/);
  if (forMatch) {
    const raw = forMatch[1].replace(/[^a-z ]/g, ' ').trim();
    for (const p of purposes) {
      if (raw.includes(p)) return p;
    }
  }
  // split by punctuation
  const tokens = text.split(/[,;|]/).map(s => s.trim());
  for (const tok of tokens) {
    for (const p of purposes) {
      if (tok.includes(p)) return p;
    }
  }
  // fuzzy match against individual words (allows small typos like "educatioon")
  const words = text.split(/[^a-z]+/).filter(Boolean);
  for (const w of words) {
    for (const p of purposes) {
      if (levenshtein(w, p) <= 2) return p;
    }
  }
  // Handle a few common typos
  for (const typo of commonMisspellings) {
    if (text.includes(typo)) {
      if (typo.startsWith('edu') || typo.includes('sduc')) return 'education';
      if (typo.startsWith('stud')) return 'education';
      if (typo.includes('med')) return 'medical';
      if (typo.includes('buss')) return 'business';
      if (typo.includes('trav')) return 'travel';
    }
  }
  return '';
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function extractKyc(message) {
  const result = { name: '', city: '', phone: '' };
  const text = message.trim();
  // phone
  const digits = text.replace(/\D/g, '');
  const phoneMatch = digits.match(/(\d{10})(\d+)?$/);
  if (phoneMatch) result.phone = phoneMatch[1];

  // city: prefer known list, else infer from remaining token
  const cityList = Array.from(new Set(customers.map(c => c.city)));
  const lower = text.toLowerCase();
  for (const city of cityList) {
    if (lower.includes(city.toLowerCase())) { result.city = city; break; }
  }

  // name: take first comma-separated part that looks like a name
  const parts = text.split(/[,|]/).map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const looksLikePhone = /\d{6,}/.test(part);
    const looksLikeCity = result.city && part.toLowerCase().includes(result.city.toLowerCase());
    if (!looksLikePhone && !looksLikeCity && /[a-zA-Z]{2,}\s+[a-zA-Z]{2,}/.test(part)) {
      result.name = part;
      break;
    }
  }

  // If city still empty, choose the last non-name, non-phone token comprised of letters/spaces
  if (!result.city) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const token = parts[i];
      if (/\d{6,}/.test(token)) continue; // phone-like
      if (token === result.name) continue; // name already picked
      if (/^[a-zA-Z ]{2,}$/.test(token)) { result.city = token; break; }
    }
  }

  return result;
}



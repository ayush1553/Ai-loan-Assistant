import { findCustomerByIdentity } from '../../store/customers.js';

export async function verificationAgent(context) {
  const { name, phone, city } = context;
  if (!name || !phone || !city) {
    // If at least name and phone are present, accept with city="Unknown"
    if (name && phone) {
      return { status: 'verified', name, city: city || 'Unknown', phone, isMock: true };
    }
    return { status: 'needs_input' };
  }

  const customer = findCustomerByIdentity({ name, phone, city });
  if (!customer) {
    // Accept any identity: treat as verified but mark as unregistered
    return { status: 'verified', name, city, phone, isMock: true };
  }
  return { status: 'verified', name: customer.name, city: customer.city, phone: customer.phone, customerId: customer.id };
}



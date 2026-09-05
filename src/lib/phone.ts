/**
 * Normalises a phone number into WhatsApp direct link format (e.g. 2348012345678).
 */
export function whatsappNumber(phone?: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits || digits.length < 7) return null
  if (digits.startsWith('234')) return digits
  if (digits.startsWith('0')) return '234' + digits.slice(1)
  if (digits.length === 10) return '234' + digits
  return digits
}

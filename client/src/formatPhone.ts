export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const num = digits.startsWith('1') ? digits.slice(1) : digits;
  let result = '+1';
  if (num.length > 0) result += ' (' + num.slice(0, 3);
  if (num.length >= 3) result += ')';
  if (num.length > 3) result += '-' + num.slice(3, 6);
  if (num.length > 6) result += '-' + num.slice(6, 10);
  return result;
}

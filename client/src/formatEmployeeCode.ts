/**
 * Call-center keypad code for an employee.
 * Same rule as server parseEmployeeCode: digits of Employee.id, zero-padded to 3
 * (id 1 → "001", id 34 → "034", id 100 → "100").
 */
export function formatEmployeeCode(id: number | null | undefined): string {
  if (id == null || !Number.isFinite(id) || id < 1) return ''
  return String(Math.trunc(id)).padStart(3, '0')
}

/** Compact badge text, e.g. "Code 001". Empty when id missing. */
export function employeeCodeLabel(id: number | null | undefined): string {
  const code = formatEmployeeCode(id)
  return code ? `Code ${code}` : ''
}

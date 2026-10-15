/**
 * Retorna lista de meses no formato 'YYYY-MM' entre as datas (inclusive).
 * @param ini Data inicial no formato 'YYYY-MM-DD'
 * @param fim Data final no formato 'YYYY-MM-DD'
 */
export function mesesDoPeriodo(ini: string, fim: string): string[] {
  const [ai, mi] = ini.split('-').map(Number);
  const [af, mf] = fim.split('-').map(Number);
  const out: string[] = [];
  let a = ai, m = mi;
  while (a < af || (a === af && m <= mf)) {
    out.push(`${a}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; a++; }
  }
  return out;
}

/**
 * Verifica se uma data (YYYY-MM-DD) está dentro do período [ini, fim] (inclusive).
 */
export function dentroDoPeriodo(data: string, ini: string, fim: string): boolean {
  return data >= ini && data <= fim;
}

import type { DescontoRecorrente } from '../types';

const r2 = (n: number) => +n.toFixed(2);

export function calcularDescontosRecorrentes(
  lista: DescontoRecorrente[] | undefined,
  base: { salarioBase: number; bruto: number }
): Array<{ chave: string; descricao: string; valor: number }> {
  const saida: Array<{ chave: string; descricao: string; valor: number }> = [];
  for (const d of lista || []) {
    if (!d.ativo) continue;
    const referencia = d.base === 'bruto' ? base.bruto : base.salarioBase;
    const bruto = d.tipo === 'percentual' ? (referencia * d.valor) / 100 : d.valor;
    const valor = r2(Math.max(bruto, 0));
    if (valor > 0) saida.push({ chave: `rec-${d.id}`, descricao: d.nome, valor });
  }
  return saida;
}

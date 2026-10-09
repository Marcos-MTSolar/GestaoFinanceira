/**
 * Formatação e utilitários em conformidade com o padrão brasileiro (pt-BR)
 */

export function formatarMoeda(valor: number): string {
  if (isNaN(valor)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

export function parseMoedaInput(texto: string): number {
  if (!texto) return 0;
  // Remove R$, espaços e pontos de milhar, substitui vírgula por ponto
  const limpo = texto
    .replace(/[^\d,-]/g, '')
    .replace(',', '.');
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
}

export function formatarDataBR(dataIso: string | null | undefined): string {
  if (!dataIso) return '-';
  // Aceita YYYY-MM-DD ou Date string
  const partes = dataIso.split('T')[0].split('-');
  if (partes.length === 3) {
    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
  }
  const d = new Date(dataIso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

export function obterHojeISO(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function estaAtrasado(status: string, dataVencimento: string): boolean {
  if (status !== 'pendente') return false;
  if (!dataVencimento) return false;
  const hoje = obterHojeISO();
  return dataVencimento < hoje;
}

export function formatarCpfCnpj(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length <= 11) {
    // CPF: 000.000.000-00
    return digitos
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  // CNPJ: 00.000.000/0000-00
  return digitos
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length <= 10) {
    return digitos
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{4})$/, '$1-$2');
  }
  return digitos
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{4})$/, '$1-$2');
}

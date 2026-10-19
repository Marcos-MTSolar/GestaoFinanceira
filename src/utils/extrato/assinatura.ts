// MT Solar - Gestão Financeira
// Gerador de Assinaturas Fortes e Fracas para Deduplicação de Extratos (Parte 15C)

import { TipoTransacaoExtrato } from './tipos';

/**
 * Extrai o prefixo operacional da descrição normalizada da transação.
 * Permite o pareamento cruzado entre extratos (ex: "PIX ENVIADO" do XLSX com "PIX ENVIADO GIRLANE..." do OFX).
 */
export function extrairPrefixoDescricao(descricaoNormalizada: string): string {
  if (!descricaoNormalizada) return '';
  const palavras = descricaoNormalizada.trim().split(/\s+/).filter(Boolean);
  // Retorna até 2 palavras iniciais que identificam o tipo da operação bancária
  return palavras.slice(0, Math.min(2, palavras.length)).join(' ');
}

/**
 * Assinatura Forte: identificador unívoco de transação fornecido pela instituição bancária.
 * Formato: banco_codigo + conta + FITID
 */
export function gerarAssinaturaForte(
  bancoCodigo: string,
  conta: string,
  fitid?: string | null
): string | null {
  if (!fitid || !fitid.trim()) return null;
  const bancoLimpo = bancoCodigo.replace(/\D/g, '') || bancoCodigo.trim();
  const contaLimpa = conta.replace(/\D/g, '') || conta.trim();
  const fitidLimpo = fitid.trim();
  return `${bancoLimpo}_${contaLimpa}_${fitidLimpo}`;
}

export interface ParametrosAssinaturaFraca {
  conta: string; // conta_id ou número da conta
  data: string; // 'YYYY-MM-DD'
  tipo: TipoTransacaoExtrato; // 'credito' | 'debito'
  valor: number; // valor monetário positivo
  descricaoNormalizada: string;
  ordemNoDia: number; // desambiguação determinística de transações gêmeas no mesmo dia
}

/**
 * Assinatura Fraca: identificador determinístico baseado nas propriedades intrínsecas da transação.
 * Formato: conta + data + tipo + valor em centavos + prefixo da descrição normalizada + ordemNoDia
 */
export function gerarAssinaturaFraca(params: ParametrosAssinaturaFraca): string {
  const contaLimpa = params.conta.replace(/\D/g, '') || params.conta.trim();
  const data = params.data.trim();
  const tipo = params.tipo;
  const valorCentavos = Math.round(params.valor * 100);
  const prefixoDesc = extrairPrefixoDescricao(params.descricaoNormalizada);
  const ordem = params.ordemNoDia;

  return `${contaLimpa}_${data}_${tipo}_${valorCentavos}_${prefixoDesc}_${ordem}`;
}

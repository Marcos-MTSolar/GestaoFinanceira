// MT Solar - Gestão Financeira
// Classificação e Deduplicação Pura de Transações Bancárias (Parte 15C)

import { Lancamento, TipoLancamento } from '../../types';
import { TransacaoExtrato, TipoTransacaoExtrato } from './tipos';
import {
  gerarAssinaturaForte,
  gerarAssinaturaFraca,
  extrairPrefixoDescricao
} from './assinatura';

/**
 * Converte TipoTransacaoExtrato ('credito'|'debito') para TipoLancamento ('receita'|'despesa').
 * Necessário para comparações entre transações de extrato e lançamentos já gravados.
 */
function tipoExtrato(tipo: TipoTransacaoExtrato): TipoLancamento {
  return tipo === 'credito' ? 'receita' : 'despesa';
}

export type StatusClassificacao =
  | 'nova'
  | 'duplicada_exata'
  | 'enriquecer_existente'
  | 'possivel_duplicata_manual';

export interface TransacaoClassificada {
  transacao: TransacaoExtrato;
  status: StatusClassificacao;
  idDoLancamentoRelacionado?: string;
  lancamentoRelacionado?: Lancamento;
  assinaturaFraca: string;
  assinaturaForte?: string | null;
  motivo: string;
}

export interface ContextoClassificacao {
  contaId: string;
  bancoCodigo?: string;
  contaNumero?: string;
  loteId?: string;
}

/**
 * Calcula a diferença em dias corridos entre duas datas no formato 'YYYY-MM-DD'
 */
export function diferencaDias(dataIso1: string, dataIso2: string): number {
  if (!dataIso1 || !dataIso2) return 999;
  const t1 = new Date(dataIso1 + 'T00:00:00Z').getTime();
  const t2 = new Date(dataIso2 + 'T00:00:00Z').getTime();
  if (isNaN(t1) || isNaN(t2)) return 999;
  const umDiaMs = 24 * 60 * 60 * 1000;
  return Math.abs(Math.round((t1 - t2) / umDiaMs));
}

/**
 * Classifica uma lista de transações bancárias contra os lançamentos existentes no sistema,
 * identificando transações novas, duplicadas exatas, cruzamentos OFX x XLSX para enriquecimento
 * e possíveis duplicatas manuais.
 * 
 * Regras estritas:
 * (a) Mesmo FITID já importado -> duplicada_exata;
 * (b) Sem FITID: assinatura fraca já existente -> duplicada_exata;
 * (c) Cruzamento OFX x XLSX: casar por data + tipo + valor + prefixo da descrição, pareando 1:1
 *     por ordemNoDia; ao casar, NÃO criar novo: marcar enriquecer_existente;
 * (d) Idênticas no mesmo arquivo seguem separadas por ordemNoDia;
 * (e) Lançamento manual existente (mesma conta, mesmo valor, data ±2 dias, sem origem_importacao)
 *     -> possivel_duplicata_manual.
 */
export function classificarDuplicatas(
  transacoes: TransacaoExtrato[],
  lancamentosExistentes: Lancamento[],
  contexto: ContextoClassificacao
): TransacaoClassificada[] {
  const contaId = contexto.contaId;
  const bancoCodigo = contexto.bancoCodigo || '033';
  const contaNumero = contexto.contaNumero || contaId;

  // Filtrar lançamentos da mesma conta para otimizar busca
  const lancamentosConta = lancamentosExistentes.filter(l => l.conta_id === contaId);

  // Índices para busca rápida
  const mapaPorFitid = new Map<string, Lancamento>();
  const mapaPorAssinaturaFraca = new Map<string, Lancamento>();
  const lancamentosManuais: Lancamento[] = [];

  for (const lanc of lancamentosConta) {
    if (lanc.origem_importacao?.fitid) {
      mapaPorFitid.set(lanc.origem_importacao.fitid, lanc);
    }
    if (lanc.origem_importacao?.assinatura_fraca) {
      mapaPorAssinaturaFraca.set(lanc.origem_importacao.assinatura_fraca, lanc);
    }
    // Lançamento manual: não possui origem_importacao
    if (!lanc.origem_importacao && lanc.origem !== 'extrato') {
      lancamentosManuais.push(lanc);
    }
  }

  // Conjuntos para controle de pareamento 1:1 neste lote
  const lancamentosPareadosEnriquecimento = new Set<string>();
  const lancamentosPareadosDuplicatas = new Set<string>();
  const lancamentosPareadosManuais = new Set<string>();

  const resultado: TransacaoClassificada[] = [];

  for (const transacao of transacoes) {
    const assinaturaForte = gerarAssinaturaForte(bancoCodigo, contaNumero, transacao.fitid);
    const assinaturaFraca = gerarAssinaturaFraca({
      conta: contaNumero,
      data: transacao.data,
      tipo: transacao.tipo,
      valor: transacao.valor,
      descricaoNormalizada: transacao.descricaoNormalizada,
      ordemNoDia: transacao.ordemNoDia
    });

    // -----------------------------------------------------------------
    // REGRA (a): Mesmo FITID já importado -> duplicada_exata
    // -----------------------------------------------------------------
    if (transacao.fitid && mapaPorFitid.has(transacao.fitid)) {
      const lancExistente = mapaPorFitid.get(transacao.fitid)!;
      lancamentosPareadosDuplicatas.add(lancExistente.id);
      resultado.push({
        transacao,
        status: 'duplicada_exata',
        idDoLancamentoRelacionado: lancExistente.id,
        lancamentoRelacionado: lancExistente,
        assinaturaFraca,
        assinaturaForte,
        motivo: `FITID ${transacao.fitid} já importado anteriormente no sistema`
      });
      continue;
    }

    // -----------------------------------------------------------------
    // REGRA (c): Cruzamento OFX x XLSX (OFX enriquecendo XLSX existente)
    // Se a transação atual veio do OFX (tem FITID), procurar lançamento
    // originado do XLSX que ainda não tenha FITID
    // -----------------------------------------------------------------
    if (transacao.fitid) {
      const prefixoAtual = extrairPrefixoDescricao(transacao.descricaoNormalizada);
      const valorCentavosAtual = Math.round(transacao.valor * 100);

      const candidatoXlsx = lancamentosConta.find(l => {
        if (lancamentosPareadosEnriquecimento.has(l.id)) return false;
        if (l.origem_importacao?.fitid) return false; // já tem FITID, não precisa enriquecer
        
        const dataLanc = l.data_pagamento || l.data_vencimento;
        if (dataLanc !== transacao.data) return false;
        if (l.tipo !== tipoExtrato(transacao.tipo)) return false;
        if (Math.round(l.valor * 100) !== valorCentavosAtual) return false;

        const prefixoLanc = extrairPrefixoDescricao(l.descricao);
        const prefixosBatem =
          prefixoLanc === prefixoAtual ||
          transacao.descricaoNormalizada.startsWith(prefixoLanc) ||
          prefixoLanc.startsWith(prefixoAtual);

        if (!prefixosBatem) return false;

        // Pareamento 1:1 por ordemNoDia
        if (l.origem_importacao?.assinatura_fraca) {
          const sufixoOrdem = `_${transacao.ordemNoDia}`;
          return l.origem_importacao.assinatura_fraca.endsWith(sufixoOrdem);
        }

        return true;
      });

      if (candidatoXlsx) {
        lancamentosPareadosEnriquecimento.add(candidatoXlsx.id);
        resultado.push({
          transacao,
          status: 'enriquecer_existente',
          idDoLancamentoRelacionado: candidatoXlsx.id,
          lancamentoRelacionado: candidatoXlsx,
          assinaturaFraca,
          assinaturaForte,
          motivo: 'Lançamento existente do XLSX compatível para enriquecimento com FITID e detalhes do OFX'
        });
        continue;
      }
    }

    // -----------------------------------------------------------------
    // REGRA (b): Assinatura fraca já existente
    // (Inclui XLSX reimportado ou XLSX cruzando com OFX já gravado)
    // -----------------------------------------------------------------
    if (mapaPorAssinaturaFraca.has(assinaturaFraca)) {
      const lancExistente = mapaPorAssinaturaFraca.get(assinaturaFraca)!;
      lancamentosPareadosDuplicatas.add(lancExistente.id);
      resultado.push({
        transacao,
        status: 'duplicada_exata',
        idDoLancamentoRelacionado: lancExistente.id,
        lancamentoRelacionado: lancExistente,
        assinaturaFraca,
        assinaturaForte,
        motivo: 'Transação com assinatura fraca idêntica já existente no sistema'
      });
      continue;
    }

    // Se a transação atual for do XLSX (sem FITID), verificar se já existe
    // um lançamento vindo do OFX que bate exatamente por data, tipo, valor, prefixo e ordemNoDia
    if (!transacao.fitid) {
      const prefixoAtual = extrairPrefixoDescricao(transacao.descricaoNormalizada);
      const valorCentavosAtual = Math.round(transacao.valor * 100);

      const candidatoOfxJaExistente = lancamentosConta.find(l => {
        if (lancamentosPareadosDuplicatas.has(l.id)) return false;
        
        const dataLanc = l.data_pagamento || l.data_vencimento;
        if (dataLanc !== transacao.data) return false;
        if (l.tipo !== tipoExtrato(transacao.tipo)) return false;
        if (Math.round(l.valor * 100) !== valorCentavosAtual) return false;

        const prefixoLanc = extrairPrefixoDescricao(l.descricao);
        const prefixosBatem =
          prefixoLanc === prefixoAtual ||
          l.descricao.toUpperCase().startsWith(prefixoAtual) ||
          prefixoAtual.startsWith(prefixoLanc);

        if (!prefixosBatem) return false;

        if (l.origem_importacao?.assinatura_fraca) {
          const sufixoOrdem = `_${transacao.ordemNoDia}`;
          return l.origem_importacao.assinatura_fraca.endsWith(sufixoOrdem);
        }

        return true;
      });

      if (candidatoOfxJaExistente) {
        lancamentosPareadosDuplicatas.add(candidatoOfxJaExistente.id);
        resultado.push({
          transacao,
          status: 'duplicada_exata',
          idDoLancamentoRelacionado: candidatoOfxJaExistente.id,
          lancamentoRelacionado: candidatoOfxJaExistente,
          assinaturaFraca,
          assinaturaForte,
          motivo: 'Transação do XLSX já coberta por lançamento enriquecido do OFX existente'
        });
        continue;
      }
    }

    // -----------------------------------------------------------------
    // REGRA (e): Lançamento manual existente (mesma conta, mesmo valor, data ±2 dias, sem origem_importacao)
    // -> possivel_duplicata_manual
    // -----------------------------------------------------------------
    const valorCentavosAtual = Math.round(transacao.valor * 100);
    const candidatoManual = lancamentosManuais.find(l => {
      if (lancamentosPareadosManuais.has(l.id)) return false;
      if (l.tipo !== tipoExtrato(transacao.tipo)) return false;
      if (Math.round(l.valor * 100) !== valorCentavosAtual) return false;

      const dataLanc = l.data_pagamento || l.data_vencimento;
      const dif = diferencaDias(dataLanc, transacao.data);
      return dif <= 2;
    });

    if (candidatoManual) {
      lancamentosPareadosManuais.add(candidatoManual.id);
      resultado.push({
        transacao,
        status: 'possivel_duplicata_manual',
        idDoLancamentoRelacionado: candidatoManual.id,
        lancamentoRelacionado: candidatoManual,
        assinaturaFraca,
        assinaturaForte,
        motivo: `Lançamento manual existente encontrado com mesmo valor e data próxima (±2 dias, data: ${candidatoManual.data_pagamento || candidatoManual.data_vencimento})`
      });
      continue;
    }

    // -----------------------------------------------------------------
    // REGRA (d): Transação nova sem correspondência prévia
    // (Transações idênticas no mesmo arquivo seguem separadas por ordemNoDia)
    // -----------------------------------------------------------------
    resultado.push({
      transacao,
      status: 'nova',
      assinaturaFraca,
      assinaturaForte,
      motivo: 'Transação nova sem duplicatas identificadas'
    });
  }

  return resultado;
}

/**
 * Função pura que enriquece um lançamento existente originado do XLSX com os dados detalhados
 * provenientes de uma transação do OFX (preservando rigorosamente a categoria já escolhida).
 */
export function enriquecerLancamento(
  lancamentoExistente: Lancamento,
  transacaoOfx: TransacaoExtrato,
  loteId: string,
  bancoCodigo: string,
  contaId: string,
  assinaturaFraca: string
): Lancamento {
  const observacoesAtualizadas = transacaoOfx.contraparte
    ? `Favorecido: ${transacaoOfx.contraparte}${lancamentoExistente.observacoes ? ` | ${lancamentoExistente.observacoes}` : ''}`
    : lancamentoExistente.observacoes;

  return {
    ...lancamentoExistente,
    descricao: transacaoOfx.descricaoOriginal || lancamentoExistente.descricao,
    observacoes: observacoesAtualizadas,
    origem_importacao: {
      lote_id: loteId,
      banco_codigo: bancoCodigo,
      conta_id: contaId,
      fitid: transacaoOfx.fitid,
      assinatura_fraca: assinaturaFraca,
      formato: 'ofx'
    }
  };
}

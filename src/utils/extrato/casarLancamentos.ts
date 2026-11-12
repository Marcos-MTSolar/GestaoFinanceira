// MT Solar - Gestão Financeira
// Casamento Inteligente de Lançamentos Pagos e Pendentes com o Extrato Bancário (Parte 24D)
// Função PURA sem efeitos colaterais

import { Lancamento, TipoLancamento } from '../../types';
import { TransacaoExtrato, TipoTransacaoExtrato } from './tipos';
import { diferencaDias } from './classificarDuplicatas';

export type NivelCertezaCasamento = 'ALTA' | 'MEDIA' | 'BAIXA';

export interface CandidatoCasamento {
  lancamento: Lancamento;
  pontuacao: number;
  nivel: NivelCertezaCasamento;
  diferencaDias: number;
  mesmaConta: boolean;
  motivos: string[];
}

export interface CasamentoTransacaoResultado {
  transacao: TransacaoExtrato;
  candidatoPrincipal?: CandidatoCasamento;
  candidatosAlternativos: CandidatoCasamento[];
  nivel: NivelCertezaCasamento;
  statusSugerido: 'vincular_automatico' | 'decisao_manual' | 'nova';
}

/**
 * Normaliza textos para comparação insensível a caixa, acentos e pontuação.
 */
function normalizarTexto(texto?: string): string {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converte o tipo do extrato bancário para o tipo de lançamento financeiro.
 */
function tipoExtratoParaLancamento(tipo: TipoTransacaoExtrato): TipoLancamento {
  return tipo === 'credito' ? 'receita' : 'despesa';
}

/**
 * Calcula a pontuação e certeza de um candidato a casamento com a transação.
 */
export function pontuarCandidato(
  transacao: TransacaoExtrato,
  lancamento: Lancamento,
  contaExtratoId: string
): CandidatoCasamento | null {
  // 1. Tipo deve ser compatível (débito -> despesa, crédito -> receita)
  if (lancamento.tipo !== tipoExtratoParaLancamento(transacao.tipo)) {
    return null;
  }

  // 2. Não casar com cancelados
  if (lancamento.status === 'cancelado') {
    return null;
  }

  // 3. Valor em centavos: obrigatório bater com o valor efetivo ou valor original
  const valorCentavosTransacao = Math.round(transacao.valor * 100);
  const valorCentavosLancamento = Math.round(lancamento.valor * 100);
  const valorOriginalCentavos = lancamento.valor_original ? Math.round(lancamento.valor_original * 100) : null;

  const bateValorEfetivo = valorCentavosLancamento === valorCentavosTransacao;
  const bateValorOriginal = valorOriginalCentavos !== null && valorOriginalCentavos === valorCentavosTransacao;

  if (!bateValorEfetivo && !bateValorOriginal) {
    return null;
  }

  // 4. Data de referência: data_pagamento se existir (já liquidado), senão data_vencimento
  const dataReferenciaLanc = lancamento.data_pagamento || lancamento.data_vencimento;
  const difDias = diferencaDias(transacao.data, dataReferenciaLanc);

  // Janela máxima de tolerância para avaliação de casamento: até 10 dias
  if (difDias > 10) {
    return null;
  }

  let pontuacao = 0;
  const motivos: string[] = [];

  // Pontuação de Valor
  if (bateValorEfetivo) {
    pontuacao += 50;
    motivos.push('Valor exato em centavos');
  } else if (bateValorOriginal) {
    pontuacao += 45;
    motivos.push('Valor original antes de juros/multa/desconto');
  }

  // Pontuação de Data
  if (difDias === 0) {
    pontuacao += 30;
    motivos.push('Mesma data');
  } else if (difDias <= 1) {
    pontuacao += 25;
    motivos.push('Diferença de 1 dia');
  } else if (difDias <= 3) {
    pontuacao += 20;
    motivos.push(`Diferença de ${difDias} dias`);
  } else if (difDias <= 7) {
    pontuacao += 10;
    motivos.push(`Diferença de ${difDias} dias`);
  } else {
    pontuacao += 5;
    motivos.push(`Diferença de ${difDias} dias`);
  }

  // Pontuação de Conta
  const mesmaConta = lancamento.conta_id === contaExtratoId;
  if (mesmaConta) {
    pontuacao += 15;
    motivos.push('Mesma conta bancária');
  } else {
    motivos.push('Conta diferente no sistema');
  }

  // Similaridade de Documento
  const docTransacao = (transacao.documento || transacao.contraparteDocumento || '').replace(/\D/g, '');
  const obsLancamento = lancamento.observacoes || '';
  if (docTransacao.length >= 4) {
    if (obsLancamento.includes(docTransacao) || lancamento.descricao.includes(docTransacao)) {
      pontuacao += 20;
      motivos.push('Número do documento coincidente');
    }
  }

  // Similaridade de Texto (descrição, mensagem do usuário, contraparte, favorecido)
  const textoLancNorm = normalizarTexto(`${lancamento.descricao} ${lancamento.observacoes || ''}`);
  const termosTransacao = [
    transacao.descricaoNormalizada,
    transacao.contraparte,
    transacao.favorecido,
    transacao.mensagemUsuario,
  ]
    .filter(Boolean)
    .map(t => normalizarTexto(t))
    .join(' ');

  if (termosTransacao) {
    const palavrasTransacao = termosTransacao.split(' ').filter(p => p.length >= 4);
    let palavrasCoincidentes = 0;
    for (const p of palavrasTransacao) {
      if (textoLancNorm.includes(p)) {
        palavrasCoincidentes++;
      }
    }
    if (palavrasCoincidentes >= 2) {
      pontuacao += 15;
      motivos.push('Similaridade alta de texto/favorecido');
    } else if (palavrasCoincidentes === 1) {
      pontuacao += 5;
      motivos.push('Termo coincidente');
    }
  }

  // Status do lançamento
  if (lancamento.status === 'pago') {
    pontuacao += 5;
    motivos.push('Lançamento já baixado como pago');
  } else if (lancamento.status === 'pendente') {
    motivos.push('Lançamento pendente em aberto');
  }

  // Classificação do Nível de Certeza
  let nivel: NivelCertezaCasamento = 'BAIXA';

  // Nível ALTA: valor bate, mesma conta, data <= 3 dias e pontuação alta
  if (mesmaConta && difDias <= 3 && pontuacao >= 70) {
    nivel = 'ALTA';
  } else if (pontuacao >= 55 && difDias <= 7) {
    nivel = 'MEDIA';
  } else {
    nivel = 'BAIXA';
  }

  return {
    lancamento,
    pontuacao,
    nivel,
    diferencaDias: difDias,
    mesmaConta,
    motivos,
  };
}

/**
 * Realiza o casamento 1:1 determinístico entre transações do extrato e lançamentos existentes.
 */
export function casarLancamentosComExtrato(
  transacoes: TransacaoExtrato[],
  lancamentosExistentes: Lancamento[],
  contaExtratoId: string
): Map<string, CasamentoTransacaoResultado> {
  const mapaResultados = new Map<string, CasamentoTransacaoResultado>();
  const lancamentosJaReivindicados = new Set<string>();

  // Pré-filtra candidatos elegíveis: exclui cancelados e os que já possuem fitid/origem_importacao consolidada
  const candidatosDisponiveis = lancamentosExistentes.filter((l) => {
    if (l.status === 'cancelado') return false;
    // Se já foi importado por lote de extrato, não deve casar novamente como lançamento manual
    if (l.origem_importacao?.fitid || l.origem_importacao?.lote_id) return false;
    return true;
  });

  // Ordena transações para consistência 1:1 (por data, valor e ordemNoDia)
  const transacoesOrdenadas = [...transacoes].sort((a, b) => {
    if (a.data !== b.data) return a.data.localeCompare(b.data);
    if (a.valor !== b.valor) return a.valor - b.valor;
    return (a.ordemNoDia ?? 0) - (b.ordemNoDia ?? 0);
  });

  for (const transacao of transacoesOrdenadas) {
    // Avalia todos os lançamentos candidatos disponíveis que ainda não foram reivindicados
    const avaliados: CandidatoCasamento[] = [];

    for (const lanc of candidatosDisponiveis) {
      if (lancamentosJaReivindicados.has(lanc.id)) continue;

      const cand = pontuarCandidato(transacao, lanc, contaExtratoId);
      if (cand && cand.nivel !== 'BAIXA') {
        avaliados.push(cand);
      }
    }

    // Ordenação determinística de desempate:
    // 1) Maior pontuação
    // 2) Menor diferença de dias
    // 3) Mesma conta prioritária
    // 4) Menor id (alfanumérico)
    avaliados.sort((a, b) => {
      if (b.pontuacao !== a.pontuacao) return b.pontuacao - a.pontuacao;
      if (a.diferencaDias !== b.diferencaDias) return a.diferencaDias - b.diferencaDias;
      if (a.mesmaConta !== b.mesmaConta) return a.mesmaConta ? -1 : 1;
      return a.lancamento.id.localeCompare(b.lancamento.id);
    });

    if (avaliados.length === 0) {
      mapaResultados.set(transacao.idTemporario, {
        transacao,
        candidatosAlternativos: [],
        nivel: 'BAIXA',
        statusSugerido: 'nova',
      });
      continue;
    }

    const principal = avaliados[0];
    const alternativos = avaliados.slice(1);

    // Reivindica o lançamento principal para manter o pareamento 1:1 rigoroso
    lancamentosJaReivindicados.add(principal.lancamento.id);

    // Condição para ALTA e vinculação automática:
    // Deve ser nível ALTA, mesma conta, e sem candidato concorrente com mesma pontuação máxima
    const temConcorrenteProximo = alternativos.length > 0 && alternativos[0].pontuacao === principal.pontuacao;

    if (principal.nivel === 'ALTA' && principal.mesmaConta && !temConcorrenteProximo) {
      mapaResultados.set(transacao.idTemporario, {
        transacao,
        candidatoPrincipal: principal,
        candidatosAlternativos: alternativos,
        nivel: 'ALTA',
        statusSugerido: 'vincular_automatico',
      });
    } else {
      // Ambiguidade, diferença de conta ou nível MÉDIA -> decisão manual do usuário
      mapaResultados.set(transacao.idTemporario, {
        transacao,
        candidatoPrincipal: principal,
        candidatosAlternativos: alternativos,
        nivel: 'MEDIA',
        statusSugerido: 'decisao_manual',
      });
    }
  }

  return mapaResultados;
}

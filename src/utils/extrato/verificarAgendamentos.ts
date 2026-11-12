// MT Solar - Gestão Financeira
// Verificação de Pagamentos Agendados na Importação do Extrato (Parte 24E)
// Função PURA sem efeitos colaterais

import { Lancamento, AgendamentoLancamento } from '../../types';
import { ExtratoLido, TransacaoExtrato } from './tipos';
import { casarLancamentosComExtrato, pontuarCandidato } from './casarLancamentos';
import { diferencaDias } from './classificarDuplicatas';

export interface AgendamentoVerificado {
  lancamento: Lancamento;
  statusResultado: 'confirmado' | 'confirmado_futuro' | 'nao_localizado' | 'fora_da_cobertura';
  transacaoCasada?: TransacaoExtrato;
  transacaoFutura?: any;
  candidataValorDiferente?: TransacaoExtrato;
  mensagem: string;
}

export interface ResultadoVerificacaoAgendamentos {
  confirmados: AgendamentoVerificado[];
  confirmadosComoFuturo: AgendamentoVerificado[];
  naoLocalizados: AgendamentoVerificado[];
  foraDaCobertura: AgendamentoVerificado[];
}

/**
 * Adiciona dias a uma data ISO YYYY-MM-DD
 */
function adicionarDiasISO(dataISO: string, dias: number): string {
  const d = new Date(dataISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().split('T')[0];
}

/**
 * Calcula a cobertura efetiva da importação do extrato.
 * Se periodo.fim >= hoje, usa hoje - 1 para evitar alertas falsos de operações do dia em andamento.
 */
export function calcularCoberturaEfetiva(periodoFim: string, hojeISO: string): string {
  if (periodoFim >= hojeISO) {
    return adicionarDiasISO(hojeISO, -1);
  }
  return periodoFim;
}

/**
 * Verifica pagamentos agendados contra o extrato bancário importado.
 *
 * Regras (Parte 24E):
 * 1. Só avalia agendamentos cuja conta_id é a conta do extrato e cujo status seja 'ativo' ou 'nao_localizado'.
 * 2. Cobertura efetiva = período.fim do extrato (ou hoje - 1 se fim >= hoje).
 * 3. Tolerância para fim de semana/feriado/compensação: até +4 dias corridos após a data agendada.
 * 4. Se a data agendada + tolerância > cobertura efetiva -> 'fora_da_cobertura' (sem alerta).
 * 5. Casou com transação do extrato -> 'confirmados' (baixa automática e vínculo, status 'confirmado').
 * 6. Constou em lancamentosFuturos do extrato (24B) -> 'confirmados_futuro' (sem alerta).
 * 7. Não casou e data agendada + tolerância <= cobertura -> 'nao_localizado'.
 *    Se houver transação de débito no mesmo período com valor diferente ou fornecedor parecido, exibe como candidata.
 */
export function verificarAgendamentos(
  lancamentos: Lancamento[],
  extrato: ExtratoLido,
  contaExtratoId: string,
  hojeISO: string
): ResultadoVerificacaoAgendamentos {
  const confirmados: AgendamentoVerificado[] = [];
  const confirmadosComoFuturo: AgendamentoVerificado[] = [];
  const naoLocalizados: AgendamentoVerificado[] = [];
  const foraDaCobertura: AgendamentoVerificado[] = [];

  const coberturaEfetiva = calcularCoberturaEfetiva(extrato.periodo.fim, hojeISO);

  // 1. Filtrar agendamentos pertinentes a esta conta
  const agendamentosCandidatos = lancamentos.filter((l) => {
    if (!l.agendamento) return false;
    if (l.agendamento.status === 'cancelado' || l.agendamento.status === 'confirmado') return false;
    // Agendado na conta deste extrato
    return l.agendamento.conta_id === contaExtratoId || l.conta_id === contaExtratoId;
  });

  if (agendamentosCandidatos.length === 0) {
    return { confirmados, confirmadosComoFuturo, naoLocalizados, foraDaCobertura };
  }

  // 2. Mapeamento de casamento prévio usando o motor 24D
  const mapaCasamentos = casarLancamentosComExtrato(
    extrato.transacoes,
    agendamentosCandidatos,
    contaExtratoId
  );

  const idsLancamentosCasados = new Map<string, TransacaoExtrato>();
  for (const [, resultado] of mapaCasamentos.entries()) {
    if (resultado.candidatoPrincipal && resultado.nivel !== 'BAIXA') {
      idsLancamentosCasados.set(resultado.candidatoPrincipal.lancamento.id, resultado.transacao);
    }
  }

  // 3. Avaliação de cada lançamento agendado
  for (const lanc of agendamentosCandidatos) {
    const agend = lanc.agendamento!;
    const dataAgendada = agend.data || lanc.data_vencimento;

    // Tolerância de até 4 dias para compensação bancária e finais de semana
    const dataLimiteTolerancia = adicionarDiasISO(dataAgendada, 4);

    // Caso 1: Casou com débito no extrato
    if (idsLancamentosCasados.has(lanc.id)) {
      const transacao = idsLancamentosCasados.get(lanc.id)!;
      confirmados.push({
        lancamento: lanc,
        statusResultado: 'confirmado',
        transacaoCasada: transacao,
        mensagem: `Agendamento confirmado no extrato em ${transacao.data} (R$ ${transacao.valor.toFixed(2)})`,
      });
      continue;
    }

    // Caso 2: Constou nos Lançamentos Futuros do extrato (Parte 24B)
    const lancamentosFuturos = extrato.lancamentosFuturos || [];
    const futuroCasado = lancamentosFuturos.find((f: any) => {
      const valorCentavosFuturo = Math.round(f.valor * 100);
      const valorCentavosLanc = Math.round(lanc.valor * 100);
      return valorCentavosFuturo === valorCentavosLanc && f.tipo === 'debito';
    });

    if (futuroCasado) {
      confirmadosComoFuturo.push({
        lancamento: lanc,
        statusResultado: 'confirmado_futuro',
        transacaoFutura: futuroCasado,
        mensagem: `Confirmado no banco como débito futuro previsto para ${futuroCasado.data}`,
      });
      continue;
    }

    // Caso 3: Fora da cobertura efetiva do extrato
    // Se a data limite de tolerância é posterior à cobertura efetiva do extrato, não podemos afirmar que falhou
    if (dataAgendada > coberturaEfetiva || dataLimiteTolerancia > coberturaEfetiva) {
      foraDaCobertura.push({
        lancamento: lanc,
        statusResultado: 'fora_da_cobertura',
        mensagem: `Agendamento para ${dataAgendada} está fora da cobertura do extrato (cobertura até ${coberturaEfetiva})`,
      });
      continue;
    }

    // Caso 4: Não localizado dentro do período com cobertura completa
    // Procura se há alguma transação com valor diferente na data próxima como candidata
    const transacaoComValorDiferente = extrato.transacoes.find((t) => {
      if (t.tipo !== 'debito') return false;
      const dif = diferencaDias(t.data, dataAgendada);
      return dif <= 3 && Math.abs(t.valor - lanc.valor) <= 150; // valor próximo (possível juros/desconto)
    });

    naoLocalizados.push({
      lancamento: lanc,
      statusResultado: 'nao_localizado',
      candidataValorDiferente: transacaoComValorDiferente,
      mensagem: `O pagamento agendado de R$ ${lanc.valor.toFixed(2)} (${lanc.descricao}) para ${dataAgendada} não apareceu no extrato até ${coberturaEfetiva}.`,
    });
  }

  return {
    confirmados,
    confirmadosComoFuturo,
    naoLocalizados,
    foraDaCobertura,
  };
}


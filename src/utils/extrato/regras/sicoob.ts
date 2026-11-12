// MT Solar - Gestão Financeira
// Regras de Classificação de Natureza para o Banco Sicoob (Partes 22C e 24C)

import { RegraClassificacaoBanco } from '../classificarTransacao';

/**
 * Regras do Sicoob ordenadas por prioridade (sugestões; o usuário sempre pode alterar/personalizar).
 * O casamento é realizado contra `descricaoNormalizada` (maiúscula, sem acento, pontuação em espaços, sem números variáveis).
 *
 * ORDEM DE PRECEDÊNCIA (Parte 24C):
 * 1. Transferência entre contas próprias (IF-MSM) — ANTES de PIX EMIT genérico!
 * 2. Movimentações internas (RDC, poupança, cota capital)
 * 3. Tarifas bancárias (IOF, tarifas, cesta)
 * 4. Recebimentos (PIX RECEB.OUTRA IF, DEP DIN, CR ANT)
 * 5. Pagamentos (PIX EMIT.OUTRA IF, DB.TR.C.DIF.TIT.INT, DÉB.TIT.COMPE.EFETI, boletos)
 */
export const REGRAS_SICOOB: RegraClassificacaoBanco[] = [
  // -------------------------------------------------------------------------
  // 1. Transferência entre contas próprias (mesma titularidade)
  //    Tratamento idêntico ao Contamax: padrão "ignorar", nunca gera despesa
  // -------------------------------------------------------------------------
  {
    natureza: 'transferencia_propria',
    tipoLancamentoSugerido: 'transferencia',
    categoriaSugeridaNome: undefined,
    testar: (desc) => /IF-MSM|IF MSM/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // 2. Movimentações internas (aplicação RDC, poupança, cota capital)
  //    Tratamento padrão: ignorar (não cria lançamento; saldo final permanece correto)
  // -------------------------------------------------------------------------
  {
    natureza: 'movimentacao_interna',
    tipoLancamentoSugerido: 'transferencia',
    categoriaSugeridaNome: undefined,
    testar: (desc) => /APLICACAO RDC|RESGATE RDC|RESG RDC|APLIC RDC/i.test(desc),
  },
  {
    natureza: 'movimentacao_interna',
    tipoLancamentoSugerido: 'transferencia',
    categoriaSugeridaNome: undefined,
    testar: (desc) => /TRANSF POUPANCA/i.test(desc),
  },
  {
    natureza: 'movimentacao_interna',
    tipoLancamentoSugerido: 'transferencia',
    categoriaSugeridaNome: undefined,
    testar: (desc) => /SUBS INTEG|INTEGRALIZ|COTA CAPITAL/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // 3. Tarifas bancárias (IOF, cesta, tarifas, juros)
  // -------------------------------------------------------------------------
  {
    natureza: 'tarifa_bancaria',
    tipoLancamentoSugerido: 'despesa',
    categoriaSugeridaNome: 'Taxas bancárias',
    testar: (desc) => /\bTARIFA|\bCESTA\b|\bIOF\b|JUROS/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // 4. Recebimentos (PIX RECEB.OUTRA IF, depósitos, créditos antecipados)
  // -------------------------------------------------------------------------
  {
    natureza: 'recebimento',
    tipoLancamentoSugerido: 'receita',
    categoriaSugeridaNome: 'Outras receitas',
    testar: (desc) => /PIX\s*RECEB|CREDITO PIX|CRED PIX|RECEBIMENTO PIX|PIX RECEBID|^DEP DIN|^CR ANT/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // 5. Pagamentos (PIX EMIT.OUTRA IF, DB.TR.C.DIF.TIT.INT, DÉB.TIT.COMPE.EFETI, boletos)
  // -------------------------------------------------------------------------
  {
    natureza: 'pagamento',
    tipoLancamentoSugerido: 'despesa',
    categoriaSugeridaNome: 'Outras despesas',
    testar: (desc) =>
      /DB TR C DIF TIT INT|DEB TIT COMPE EFETI|D[EÉ]B\.?TIT\.?COMPE\.?EFETI|PIX\s*EMIT|DEBITO PIX|DEB PIX|PAGAMENTO PIX|PIX ENVIAD|PAGAMENTO BOLETO|LIQUIDACAO BOLETO/i.test(desc),
  },
];

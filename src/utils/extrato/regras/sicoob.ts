// MT Solar - Gestão Financeira
// Regras de Classificação de Natureza para o Banco Sicoob (Parte 22C)

import { RegraClassificacaoBanco } from '../classificarTransacao';

/**
 * Regras do Sicoob ordenadas por prioridade (sugestões; o usuário sempre pode alterar/personalizar).
 * O casamento é realizado contra `descricaoNormalizada` (maiúscula, sem acento, pontuação em espaços, sem números variáveis).
 *
 * NOTA DE HOMOLOGAÇÃO:
 * - Padrões confirmados em extrato real do Sicoob:
 *     DEP DIN AG, CR ANT MSTD, DEB PARC SUBS INTEG, APLICACAO RDC, DEB TRANSF POUPANCA.
 * - Os demais padrões (CESTA, IOF, JUROS, CREDITO/CRED PIX, DEBITO/DEB PIX, LIQUIDACAO BOLETO, etc.)
 *   são prováveis e foram incluídos como sugestões heurísticas de apoio.
 * - O que não casar com nenhuma destas regras fica como 'indefinido' (o usuário informa a categoria
 *   desejada na revisão e o aplicativo aprende por meio das regras do usuário).
 */
export const REGRAS_SICOOB: RegraClassificacaoBanco[] = [
  // -------------------------------------------------------------------------
  // 1. Movimentações internas (aplicação RDC, poupança, cota capital)
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
  // 2. Tarifas bancárias (IOF, cesta, tarifas, juros)
  // -------------------------------------------------------------------------
  {
    natureza: 'tarifa_bancaria',
    tipoLancamentoSugerido: 'despesa',
    categoriaSugeridaNome: 'Taxas bancárias',
    testar: (desc) => /\bTARIFA|\bCESTA\b|\bIOF\b|JUROS/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // 3. Recebimentos (depósitos, créditos antecipados, PIX recebidos)
  // -------------------------------------------------------------------------
  {
    natureza: 'recebimento',
    tipoLancamentoSugerido: 'receita',
    categoriaSugeridaNome: 'Outras receitas',
    testar: (desc) => /^DEP DIN|^CR ANT|CREDITO PIX|CRED PIX|RECEBIMENTO PIX|PIX RECEBID/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // 4. Pagamentos (PIX enviados, liquidação e pagamento de boletos)
  // -------------------------------------------------------------------------
  {
    natureza: 'pagamento',
    tipoLancamentoSugerido: 'despesa',
    categoriaSugeridaNome: 'Outras despesas',
    testar: (desc) => /DEBITO PIX|DEB PIX|PAGAMENTO PIX|PIX ENVIAD|PIX EMITID|PAGAMENTO BOLETO|LIQUIDACAO BOLETO/i.test(desc),
  },
];

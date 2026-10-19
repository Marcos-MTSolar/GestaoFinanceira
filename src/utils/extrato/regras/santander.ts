// MT Solar - Gestão Financeira
// Regras de Classificação de Natureza para o Banco Santander (Parte 15D)

import { RegraClassificacaoBanco } from '../classificarTransacao';

/**
 * Regras do Santander ordenadas por prioridade (mais específicas primeiro).
 * O casamento é feito contra `descricaoNormalizada` (maiúscula, sem acento, sem números variáveis).
 *
 * Cada regra retorna uma sugestão de { natureza, tipoLancamentoSugerido, categoriaSugeridaNome? }
 * e nunca lança exceção — é apenas uma dica, nunca uma decisão definitiva.
 */
export const REGRAS_SANTANDER: RegraClassificacaoBanco[] = [
  // -------------------------------------------------------------------------
  // Movimentações internas (Contamax) - não são receita nem despesa
  // -------------------------------------------------------------------------
  {
    natureza: 'movimentacao_interna',
    tipoLancamentoSugerido: 'transferencia',
    categoriaSugeridaNome: undefined,
    testar: (desc) =>
      /APLICACAO CONTAMAX|APLICAC CONTAMAX|RESGATE CONTAMAX|CONTAMAX/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // Empréstimos e financiamentos
  // -------------------------------------------------------------------------
  {
    natureza: 'emprestimo',
    tipoLancamentoSugerido: 'despesa',
    categoriaSugeridaNome: 'Outras despesas',
    testar: (desc) =>
      /DEBITO EMPRESTIMO|PREST EMPRESTIMOS|PRESTACAO EMPRESTIMO|FINANCIAMENTO|PARCELA EMPRESTIMO|CREDITO PESSOAL/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // Tarifas bancárias (IOF, TAR, TARIFA)
  // -------------------------------------------------------------------------
  {
    natureza: 'tarifa_bancaria',
    tipoLancamentoSugerido: 'despesa',
    categoriaSugeridaNome: 'Taxas bancárias',
    testar: (desc) =>
      /\bIOF\b|^TAR |^TARIFA|TAR MANUTENCAO|TAR PACOTE|TAR SERVICO|TAR TED|TAR PIX|TAR EMISSAO|COMISSAO BANCARIA/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // Impostos e tributos
  // -------------------------------------------------------------------------
  {
    natureza: 'imposto',
    tipoLancamentoSugerido: 'despesa',
    categoriaSugeridaNome: 'Encargos e impostos',
    testar: (desc) =>
      /PAGAMENTO TRIBUTOS|PAGAMENTO DARF|DARF|GPS |GARE |PAGAMENTO DAS |PAGAMENTO INSS|PAGAMENTO FGTS|SIMPLES NACIONAL|IRPJ|CSLL|COFINS|PIS |PAGAMENTO ISS/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // Contas de consumo (luz, celular, internet, seguro)
  // -------------------------------------------------------------------------
  {
    natureza: 'conta_consumo',
    tipoLancamentoSugerido: 'despesa',
    categoriaSugeridaNome: 'Água/luz/internet',
    testar: (desc) =>
      /PAGAMENTO CONTA LUZ|PAGAMENTO LUZ|PAGAMENTO ENERGIA|PAGAMENTO AGUA|PAGAMENTO CELULAR|PAGAMENTO TELEFONE|PAGAMENTO INTERNET|MENSALIDADE DE SEGURO|SEGURO PRESTAMISTA|SEGURO RESIDENCIA|PAGAMENTO TV|PAGAMENTO GAS/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // Compras no débito (cartão débito)
  // -------------------------------------------------------------------------
  {
    natureza: 'cartao_debito',
    tipoLancamentoSugerido: 'despesa',
    categoriaSugeridaNome: 'Outras despesas',
    testar: (desc) =>
      /COMPRA CARTAO DEB|COMPRA DEBITO|DEBITO COMPRA/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // Capitalização
  // -------------------------------------------------------------------------
  {
    natureza: 'capitalizacao',
    tipoLancamentoSugerido: 'despesa',
    categoriaSugeridaNome: 'Outras despesas',
    testar: (desc) =>
      /DEBITO AUT TITULO CAPITALIZACAO|CAPITALIZACAO|TITULO DE CAPITALIZACAO/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // Acordos e dívidas
  // -------------------------------------------------------------------------
  {
    natureza: 'acordo_divida',
    tipoLancamentoSugerido: 'despesa',
    categoriaSugeridaNome: 'Outras despesas',
    testar: (desc) =>
      /DEBITO DE ACORDO|DEBITO DE DIVIDA|ACORDO EM ATRASO|REGULARIZACAO DIVIDA|ACORDO BANCARIO/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // Recebimentos (PIX recebido, depósitos, cobranças)
  // -------------------------------------------------------------------------
  {
    natureza: 'recebimento',
    tipoLancamentoSugerido: 'receita',
    categoriaSugeridaNome: 'Outras receitas',
    testar: (desc) =>
      /PIX RECEBIDO|CR COB BLOQ|COMP CONF RECEBIMENTO|DEP DINHEIRO|DEPOSITO EM DINHEIRO|TED RECEBIDA|DOC RECEBIDO|CREDITO EM CONTA|CREDITO TED|CREDITO DOC/i.test(desc),
  },

  // -------------------------------------------------------------------------
  // Pagamentos (PIX enviado, boletos)
  // -------------------------------------------------------------------------
  {
    natureza: 'pagamento',
    tipoLancamentoSugerido: 'despesa',
    categoriaSugeridaNome: 'Outras despesas',
    testar: (desc) =>
      /PIX ENVIADO|PIX AGENDADO|PAGAMENTO DE BOLETO|PAG BOLETO|PAGAMENTO BOLETO|TED ENVIADA|TRANSFERENCIA ENVIADA|DOC ENVIADO/i.test(desc),
  },
];

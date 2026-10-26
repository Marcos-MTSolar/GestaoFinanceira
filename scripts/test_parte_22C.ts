// MT Solar - Gestão Financeira
// Testes da Parte 22C: Regras de classificação do Sicoob e movimentações internas

import { classificarTransacao, resolverMovimentacaoInterna } from '../src/utils/extrato/classificarTransacao';
import { REGRAS_SICOOB } from '../src/utils/extrato/regras/sicoob';
import { REGRAS_SANTANDER } from '../src/utils/extrato/regras/santander';
import { TransacaoExtrato } from '../src/utils/extrato/tipos';

function asserir(condicao: boolean, mensagem: string) {
  if (!condicao) {
    throw new Error(`FALHA NA ASSERÇÃO: ${mensagem}`);
  }
}

// Cria uma transação sintética para teste com descricaoNormalizada especificada
function criarTransacao(descricao: string, valor: number = 100, tipo: 'credito' | 'debito' = 'credito'): TransacaoExtrato {
  return {
    idTemporario: `temp-${Date.now()}-${Math.random()}`,
    data: '2027-10-20',
    valor,
    tipo,
    descricaoOriginal: descricao,
    descricaoNormalizada: descricao,
    ordemNoDia: 0,
    linhaOrigem: 1,
  };
}

async function executarTestes() {
  console.log('🧪 Iniciando testes da PARTE 22C — Regras Sicoob e Movimentações Internas\n');

  // =========================================================================
  // BLOCO 1: Classificação das 12 descrições no Banco Sicoob ('756')
  // =========================================================================
  console.log('--- BLOCO 1: Classificação das 12 descrições no Banco Sicoob (\'756\') ---');

  const casosSicoob: Array<{
    descricao: string;
    naturezaEsperada: string;
    tipoLancamentoEsperado?: string;
    categoriaEsperada?: string;
  }> = [
    {
      descricao: 'DEP DIN AG',
      naturezaEsperada: 'recebimento',
      tipoLancamentoEsperado: 'receita',
      categoriaEsperada: 'Outras receitas',
    },
    {
      descricao: 'CR ANT MSTD',
      naturezaEsperada: 'recebimento',
      tipoLancamentoEsperado: 'receita',
      categoriaEsperada: 'Outras receitas',
    },
    {
      descricao: 'DEB PARC SUBS INTEG',
      naturezaEsperada: 'movimentacao_interna',
      tipoLancamentoEsperado: 'transferencia',
      categoriaEsperada: undefined,
    },
    {
      descricao: 'APLICACAO RDC',
      naturezaEsperada: 'movimentacao_interna',
      tipoLancamentoEsperado: 'transferencia',
      categoriaEsperada: undefined,
    },
    {
      descricao: 'DEB TRANSF POUPANCA',
      naturezaEsperada: 'movimentacao_interna',
      tipoLancamentoEsperado: 'transferencia',
      categoriaEsperada: undefined,
    },
    {
      descricao: 'CRED TRANSF POUPANCA',
      naturezaEsperada: 'movimentacao_interna',
      tipoLancamentoEsperado: 'transferencia',
      categoriaEsperada: undefined,
    },
    {
      descricao: 'DEB TARIFA PACOTE',
      naturezaEsperada: 'tarifa_bancaria',
      tipoLancamentoEsperado: 'despesa',
      categoriaEsperada: 'Taxas bancárias',
    },
    {
      descricao: 'DEB IOF',
      naturezaEsperada: 'tarifa_bancaria',
      tipoLancamentoEsperado: 'despesa',
      categoriaEsperada: 'Taxas bancárias',
    },
    {
      descricao: 'CRED PIX',
      naturezaEsperada: 'recebimento',
      tipoLancamentoEsperado: 'receita',
      categoriaEsperada: 'Outras receitas',
    },
    {
      descricao: 'DEB PIX',
      naturezaEsperada: 'pagamento',
      tipoLancamentoEsperado: 'despesa',
      categoriaEsperada: 'Outras despesas',
    },
    {
      descricao: 'LIQUIDACAO BOLETO',
      naturezaEsperada: 'pagamento',
      tipoLancamentoEsperado: 'despesa',
      categoriaEsperada: 'Outras despesas',
    },
    {
      descricao: 'XYZ DESCONHECIDO',
      naturezaEsperada: 'indefinido',
      tipoLancamentoEsperado: undefined,
      categoriaEsperada: undefined,
    },
  ];

  for (const caso of casosSicoob) {
    const tx = criarTransacao(caso.descricao);
    const resultado = classificarTransacao(tx, '756', 'conta-1', [], []);

    asserir(
      resultado.natureza === caso.naturezaEsperada,
      `[Sicoob] "${caso.descricao}": natureza esperada "${caso.naturezaEsperada}", obtida "${resultado.natureza}"`
    );

    if (caso.tipoLancamentoEsperado) {
      asserir(
        resultado.sugestao.tipoLancamentoSugerido === caso.tipoLancamentoEsperado,
        `[Sicoob] "${caso.descricao}": tipoLancamentoSugerido esperado "${caso.tipoLancamentoEsperado}", obtido "${resultado.sugestao.tipoLancamentoSugerido}"`
      );
    }

    if (caso.categoriaEsperada) {
      asserir(
        resultado.sugestao.categoriaSugeridaNome === caso.categoriaEsperada,
        `[Sicoob] "${caso.descricao}": categoriaSugeridaNome esperada "${caso.categoriaEsperada}", obtida "${resultado.sugestao.categoriaSugeridaNome}"`
      );
    }

    console.log(`  ✓ [Sicoob '756'] "${caso.descricao}" => ${resultado.natureza} (${resultado.sugestao.tipoLancamentoSugerido || 'sem tipo'} / ${resultado.sugestao.categoriaSugeridaNome || 'sem cat'})`);
  }
  console.log('✅ BLOCO 1 passou com sucesso.');

  // =========================================================================
  // BLOCO 2: Isolamento de regras (não afetam o Banco Santander '033')
  // =========================================================================
  console.log('\n--- BLOCO 2: Isolamento de regras com Banco Santander (\'033\') ---');

  // Descrições específicas do Sicoob que NÃO devem casar nas regras do Santander
  const descricoesExclusivasSicoob = [
    'DEP DIN AG',
    'CR ANT MSTD',
    'DEB PARC SUBS INTEG',
    'APLICACAO RDC',
    'DEB TRANSF POUPANCA',
    'CRED TRANSF POUPANCA',
    'DEB TARIFA PACOTE',
    'CRED PIX',
    'DEB PIX',
    'LIQUIDACAO BOLETO',
  ];

  for (const desc of descricoesExclusivasSicoob) {
    const tx = criarTransacao(desc);
    const resultado = classificarTransacao(tx, '033', 'conta-1', [], []);

    asserir(
      resultado.natureza === 'indefinido',
      `[Santander '033'] "${desc}" NÃO deve casar em regras Santander (esperado 'indefinido', obtido "${resultado.natureza}")`
    );
    console.log(`  ✓ [Santander '033'] "${desc}" permanece indefinido no Santander`);
  }
  console.log('✅ BLOCO 2 passou com sucesso.');

  // =========================================================================
  // BLOCO 3: Regras legadas do Santander continuam funcionando sem regressão
  // =========================================================================
  console.log('\n--- BLOCO 3: Regras do Santander (\'033\') continuam válidas ---');

  const casosSantander = [
    { desc: 'APLICACAO CONTAMAX', nat: 'movimentacao_interna' },
    { desc: 'RESGATE CONTAMAX', nat: 'movimentacao_interna' },
    { desc: 'PIX RECEBIDO', nat: 'recebimento' },
    { desc: 'PIX ENVIADO', nat: 'pagamento' },
    { desc: 'TAR PACOTE', nat: 'tarifa_bancaria' },
    { desc: 'DEBITO EMPRESTIMO', nat: 'emprestimo' },
  ];

  for (const caso of casosSantander) {
    const tx = criarTransacao(caso.desc);
    const res = classificarTransacao(tx, '033', 'conta-1', [], []);
    asserir(res.natureza === caso.nat, `[Santander] "${caso.desc}": esperado "${caso.nat}", obtido "${res.natureza}"`);
    console.log(`  ✓ [Santander '033'] "${caso.desc}" => ${res.natureza}`);
  }
  console.log('✅ BLOCO 3 passou com sucesso.');

  // =========================================================================
  // BLOCO 4: Tratamento padrão "ignorar" para movimentações internas do Sicoob
  // =========================================================================
  console.log('\n--- BLOCO 4: Tratamento padrão de movimentações internas (ignorar) ---');

  // Teste de resolverMovimentacaoInterna
  const modoPadrao = resolverMovimentacaoInterna();
  asserir(modoPadrao.acao === 'ignorar', 'Modo padrão sem conta de aplicação deve ser "ignorar"');
  if (modoPadrao.acao === 'ignorar') {
    asserir(
      modoPadrao.motivo.includes('Movimentação interna'),
      `Motivo deve citar movimentação interna: "${modoPadrao.motivo}"`
    );
  }

  const modoTransferencia = resolverMovimentacaoInterna('conta-aplicacao-123');
  asserir(modoTransferencia.acao === 'transferencia', 'Com conta de aplicação deve retornar "transferencia"');
  if (modoTransferencia.acao === 'transferencia') {
    asserir(modoTransferencia.contaDestinoId === 'conta-aplicacao-123', 'ID da conta destino deve coincidir');
  }

  // Simulação de cálculo de saldo com movimentações internas ignoradas:
  // Saldo inicial: R$ 5.000,00
  // Movimento 1: +R$ 1.500,00 (Recebimento DEP DIN AG)
  // Movimento 2: -R$ 1.000,00 (APLICACAO RDC - movimentação interna => IGNORADA)
  // Movimento 3: +R$ 1.000,00 (RESGATE RDC - movimentação interna => IGNORADA)
  // Movimento 4: -R$ 200,00 (Pagamento DEB PIX)
  // Saldo calculado no app (apenas lançamentos não ignorados):
  // 5.000 + 1.500 - 200 = R$ 6.300,00
  // Como a aplicação (+1000) e resgate (-1000) se anulam, o saldo bancário também é R$ 6.300,00!
  const saldoInicial = 5000;
  const transacoesExemplo = [
    { desc: 'DEP DIN AG', valor: 1500, tipo: 'credito' as const },
    { desc: 'APLICACAO RDC', valor: 1000, tipo: 'debito' as const },
    { desc: 'RESGATE RDC', valor: 1000, tipo: 'credito' as const },
    { desc: 'DEB PIX', valor: 200, tipo: 'debito' as const },
  ];

  let saldoFinalApp = saldoInicial;
  let lancamentosGravados = 0;

  for (const t of transacoesExemplo) {
    const tx = criarTransacao(t.desc, t.valor, t.tipo);
    const classif = classificarTransacao(tx, '756', 'conta-1', [], []);

    if (classif.natureza === 'movimentacao_interna') {
      const tratamento = resolverMovimentacaoInterna(); // padrão: ignorar
      if (tratamento.acao === 'ignorar') {
        // NÃO gera lançamento
        continue;
      }
    }

    lancamentosGravados++;
    saldoFinalApp += t.tipo === 'credito' ? t.valor : -t.valor;
  }

  asserir(lancamentosGravados === 2, `Deveriam ser gravados exatamente 2 lançamentos (obtido: ${lancamentosGravados})`);
  asserir(saldoFinalApp === 6300, `Saldo final do app com internas ignoradas deveria ser 6300 (obtido: ${saldoFinalApp})`);
  console.log(`  ✓ 2 lançamentos reais gravados, 2 internas ignoradas. Saldo final exato R$ ${saldoFinalApp.toFixed(2)}`);

  console.log('✅ BLOCO 4 passou com sucesso.');

  console.log('\n🎉 TODOS OS TESTES DA PARTE 22C PASSARAM COM SUCESSO!\n');
}

executarTestes().catch(err => {
  console.error('\n❌ ERRO NO TESTE DA PARTE 22C:', err);
  process.exit(1);
});

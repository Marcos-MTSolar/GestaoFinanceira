import { Lancamento, LancamentoFolha } from '../src/types';

// Mocks do cache local e das funções idênticas às implementadas em storage.ts
let cacheLancamentosFolha: LancamentoFolha[] = [];
let cacheLancamentos: Lancamento[] = [];

function getCategorias() {
  return [{ id: 'cat-des-4', nome: 'Salários', tipo: 'despesa', cor: '#000' }];
}

function getFuncionarioById(id: string) {
  return { id, nome: 'Carlos Silva' };
}

function saveLancamento(lancamento: Lancamento): Lancamento {
  const idx = cacheLancamentos.findIndex((l) => l.id === lancamento.id);
  if (idx >= 0) cacheLancamentos[idx] = lancamento;
  else cacheLancamentos.push(lancamento);
  return lancamento;
}

function saveLancamentoFolha(lancamento: LancamentoFolha): LancamentoFolha {
  const idx = cacheLancamentosFolha.findIndex((l) => l.id === lancamento.id);
  if (idx >= 0) cacheLancamentosFolha[idx] = lancamento;
  else cacheLancamentosFolha.push(lancamento);
  return lancamento;
}

function registrarAuditoria(modulo: string, acao: string, descricao: string) {
  // Mock audit
}

function espelharDespesaNaFolha(desp: Lancamento): void {
  if (desp.origem !== 'folha' || !desp.folha_id) return;

  const folha = cacheLancamentosFolha.find((l) => l.id === desp.folha_id);
  if (!folha) return;

  const novoStatus: 'pago' | 'pendente' = desp.status === 'pago' ? 'pago' : 'pendente';
  const func = getFuncionarioById(folha.funcionario_id);
  const nomeDoFuncionario = func ? func.nome : '';

  const folhaAtualizada: LancamentoFolha = {
    ...folha,
    status: novoStatus,
    data_pagamento: desp.data_pagamento,
    conta_id: desp.conta_id,
    lancamento_id: desp.id,
  };

  saveLancamentoFolha(folhaAtualizada);

  if (novoStatus === 'pago') {
    registrarAuditoria('folha', 'pagamento', `Pagamento da folha: ${folha.descricao} – ${nomeDoFuncionario}`);
  } else {
    registrarAuditoria('folha', 'estorno', `Estorno da folha: ${folha.descricao} – ${nomeDoFuncionario}`);
  }
}

function liquidarLancamento(params: {
  id: string;
  contaId?: string;
  dataPagamento?: string;
  jurosMulta?: number;
  desconto?: number;
  valorFinal?: number;
}): Lancamento | null {
  const target = cacheLancamentos.find((l) => l.id === params.id);
  if (!target) return null;
  const juros = params.jurosMulta || 0;
  const desc = params.desconto || 0;
  const valorCalculado = params.valorFinal !== undefined ? params.valorFinal : +(target.valor + juros - desc).toFixed(2);

  const atualizado: Lancamento = {
    ...target,
    status: 'pago',
    data_pagamento: params.dataPagamento || new Date().toISOString().split('T')[0],
    conta_id: params.contaId || target.conta_id,
    valor: valorCalculado,
    juros_multa: juros > 0 ? juros : undefined,
    desconto: desc > 0 ? desc : undefined,
  };
  const salva = saveLancamento(atualizado);
  if (salva.origem === 'folha' && salva.folha_id) {
    espelharDespesaNaFolha(salva);
  }
  return salva;
}

function estornarLancamento(id: string): Lancamento | null {
  const target = cacheLancamentos.find((l) => l.id === id);
  if (!target) return null;

  const atualizado: Lancamento = {
    ...target,
    status: 'pendente',
    data_pagamento: null,
  };
  const salva = saveLancamento(atualizado);
  if (salva.origem === 'folha' && salva.folha_id) {
    espelharDespesaNaFolha(salva);
  }
  return salva;
}

function garantirDespesaDaFolha(folha: LancamentoFolha): Lancamento | null {
  if (folha.tipo === 'desconto' || folha.status === 'cancelado') return null;

  const id = folha.lancamento_id || `desp-${folha.id}`;
  const despExistente = cacheLancamentos.find((l) => l.id === id);

  if (despExistente) {
    if (despExistente.status === 'pago') {
      if (folha.lancamento_id !== id) saveLancamentoFolha({ ...folha, lancamento_id: id });
      return despExistente;
    }
    const func = getFuncionarioById(folha.funcionario_id);
    const nomeDoFuncionario = func ? func.nome : '';
    const despAtualizada: Lancamento = {
      ...despExistente,
      descricao: `Folha: ${folha.descricao} – ${nomeDoFuncionario} (${folha.competencia})`,
      valor: folha.valor,
      data_vencimento: folha.data_prevista,
      conta_id: folha.conta_id,
      funcionario_id: folha.funcionario_id,
      folha_id: folha.id,
    };
    const salva = saveLancamento(despAtualizada);
    if (folha.lancamento_id !== id) saveLancamentoFolha({ ...folha, lancamento_id: id });
    return salva;
  }

  if (folha.status === 'pago') return null;

  const func = getFuncionarioById(folha.funcionario_id);
  const nomeDoFuncionario = func ? func.nome : '';

  const novaDespesa: Lancamento = {
    id,
    tipo: 'despesa',
    descricao: `Folha: ${folha.descricao} – ${nomeDoFuncionario} (${folha.competencia})`,
    valor: folha.valor,
    data_vencimento: folha.data_prevista,
    data_pagamento: null,
    status: 'pendente',
    conta_id: folha.conta_id,
    categoria_id: 'cat-des-4',
    forma_pagamento: 'transferencia',
    recorrencia: 'nenhuma',
    origem: 'folha',
    funcionario_id: folha.funcionario_id,
    folha_id: folha.id,
    criado_em: new Date().toISOString(),
  };

  const salva = saveLancamento(novaDespesa);
  if (folha.lancamento_id !== id) saveLancamentoFolha({ ...folha, lancamento_id: id });
  return salva;
}

function liquidarLancamentoFolha(id: string, contaId: string, dataPagamento?: string): { sucesso: boolean; mensagem?: string } {
  const folha = cacheLancamentosFolha.find((l) => l.id === id);
  if (!folha) return { sucesso: false, mensagem: 'Lançamento de folha não encontrado.' };
  if (folha.status === 'pago') return { sucesso: false, mensagem: 'Lançamento de folha já se encontra pago.' };
  if (folha.tipo === 'desconto') return { sucesso: false, mensagem: 'Lançamentos de folha do tipo desconto não geram despesa financeira.' };

  const desp = garantirDespesaDaFolha(folha);
  if (!desp) return { sucesso: false, mensagem: 'Não foi possível garantir a despesa associada a esta folha.' };

  const res = liquidarLancamento({ id: desp.id, contaId, dataPagamento });
  if (!res) return { sucesso: false, mensagem: 'Não foi possível liquidar a despesa no financeiro.' };

  return { sucesso: true };
}

function liquidarFolhaEmLote(folhaIds: string[], contaId: string, dataPagamento: string) {
  let quitados = 0;
  const falhas: Array<{ id: string; mensagem: string }> = [];

  for (const id of folhaIds) {
    const res = liquidarLancamentoFolha(id, contaId, dataPagamento);
    if (res.sucesso) quitados++;
    else falhas.push({ id, mensagem: res.mensagem || 'Falha ao liquidar lançamento de folha.' });
  }

  return { quitados, total: folhaIds.length, falhas };
}

console.log('--- TESTES CONFERÊNCIA PARTE 2B ---');

// Cenário a: liquidarLancamentoFolha em salário pendente com conta X e data D → despesa 'pago' com conta X e data D, folha 'pago' com a mesma conta e data
cacheLancamentosFolha = [];
cacheLancamentos = [];
const folhaA: LancamentoFolha = {
  id: 'folha-sal-1',
  funcionario_id: 'func-1',
  tipo: 'salario',
  descricao: 'Salário Mensal',
  competencia: '10/2026',
  valor: 3500,
  tipo_operacao: 'provento',
  data_prevista: '2026-10-05',
  data_pagamento: null,
  status: 'pendente',
  conta_id: 'conta-original',
  criado_em: new Date().toISOString(),
};
saveLancamentoFolha(folhaA);
const resA = liquidarLancamentoFolha('folha-sal-1', 'conta-X', '2026-10-10');
const despAFinal = cacheLancamentos.find(l => l.id === 'desp-folha-sal-1');
const folhaAFinal = cacheLancamentosFolha.find(l => l.id === 'folha-sal-1');
console.log('Cenário a:', JSON.stringify({
  sucesso: resA.sucesso,
  despesaStatus: despAFinal?.status,
  despesaConta: despAFinal?.conta_id,
  despesaDataPagamento: despAFinal?.data_pagamento,
  folhaStatus: folhaAFinal?.status,
  folhaConta: folhaAFinal?.conta_id,
  folhaDataPagamento: folhaAFinal?.data_pagamento,
}, null, 2));

// Cenário b: estornarLancamento(despesa) → despesa e folha voltam a 'pendente', data_pagamento null
const estornoB = estornarLancamento('desp-folha-sal-1');
const folhaBFinal = cacheLancamentosFolha.find(l => l.id === 'folha-sal-1');
console.log('Cenário b:', JSON.stringify({
  despesaStatus: estornoB?.status,
  despesaDataPagamento: estornoB?.data_pagamento,
  folhaStatus: folhaBFinal?.status,
  folhaDataPagamento: folhaBFinal?.data_pagamento,
}, null, 2));

// Cenário c: liquidarLancamentoFolha em folha tipo 'desconto' → sucesso false
const folhaC: LancamentoFolha = {
  id: 'folha-desc-1',
  funcionario_id: 'func-1',
  tipo: 'desconto',
  descricao: 'Falta',
  competencia: '10/2026',
  valor: 100,
  tipo_operacao: 'desconto',
  data_prevista: '2026-10-05',
  data_pagamento: null,
  status: 'pendente',
  conta_id: 'conta-1',
  criado_em: new Date().toISOString(),
};
saveLancamentoFolha(folhaC);
const resC = liquidarLancamentoFolha('folha-desc-1', 'conta-1', '2026-10-10');
console.log('Cenário c (tipo desconto):', JSON.stringify({
  sucesso: resC.sucesso,
  mensagem: resC.mensagem,
}, null, 2));

// Cenário d: liquidarLancamentoFolha em folha já paga → sucesso false
const folhaD: LancamentoFolha = {
  id: 'folha-paga-1',
  funcionario_id: 'func-1',
  tipo: 'salario',
  descricao: 'Salário Pago',
  competencia: '10/2026',
  valor: 3500,
  tipo_operacao: 'provento',
  data_prevista: '2026-10-05',
  data_pagamento: '2026-10-05',
  status: 'pago',
  conta_id: 'conta-1',
  criado_em: new Date().toISOString(),
};
saveLancamentoFolha(folhaD);
const resD = liquidarLancamentoFolha('folha-paga-1', 'conta-1', '2026-10-10');
console.log('Cenário d (já paga):', JSON.stringify({
  sucesso: resD.sucesso,
  mensagem: resD.mensagem,
}, null, 2));

// Cenário e: liquidarFolhaEmLote com 2 salários e 1 desconto → quitados 2, falhas 1
cacheLancamentosFolha = [];
cacheLancamentos = [];
saveLancamentoFolha({
  id: 'sal-lote-1', funcionario_id: 'func-1', tipo: 'salario', descricao: 'Salário 1', competencia: '10/2026', valor: 2000, tipo_operacao: 'provento', data_prevista: '2026-10-05', data_pagamento: null, status: 'pendente', conta_id: 'conta-1', criado_em: new Date().toISOString()
});
saveLancamentoFolha({
  id: 'sal-lote-2', funcionario_id: 'func-2', tipo: 'salario', descricao: 'Salário 2', competencia: '10/2026', valor: 3000, tipo_operacao: 'provento', data_prevista: '2026-10-05', data_pagamento: null, status: 'pendente', conta_id: 'conta-1', criado_em: new Date().toISOString()
});
saveLancamentoFolha({
  id: 'desc-lote-3', funcionario_id: 'func-1', tipo: 'desconto', descricao: 'Desconto 1', competencia: '10/2026', valor: 100, tipo_operacao: 'desconto', data_prevista: '2026-10-05', data_pagamento: null, status: 'pendente', conta_id: 'conta-1', criado_em: new Date().toISOString()
});

const resE = liquidarFolhaEmLote(['sal-lote-1', 'sal-lote-2', 'desc-lote-3'], 'conta-lote', '2026-10-10');
console.log('Cenário e (lote):', JSON.stringify({
  quitados: resE.quitados,
  total: resE.total,
  qtdFalhas: resE.falhas.length,
}, null, 2));

// Cenário f: liquidarLancamento em uma despesa que NÃO é de folha → comportamento idêntico ao anterior (nenhuma folha tocada)
const despManual: Lancamento = {
  id: 'desp-manual-1',
  tipo: 'despesa',
  descricao: 'Energia Elétrica',
  valor: 500,
  data_vencimento: '2026-10-10',
  data_pagamento: null,
  status: 'pendente',
  conta_id: 'conta-1',
  categoria_id: 'cat-des-1',
  forma_pagamento: 'PIX',
  recorrencia: 'nenhuma',
  origem: 'manual',
  criado_em: new Date().toISOString(),
};
saveLancamento(despManual);
const qtdFolhasAntes = cacheLancamentosFolha.length;
const despManualLiquida = liquidarLancamento({ id: 'desp-manual-1', contaId: 'conta-1', dataPagamento: '2026-10-10' });
const qtdFolhasDepois = cacheLancamentosFolha.length;
console.log('Cenário f (despesa manual):', JSON.stringify({
  status: despManualLiquida?.status,
  folhasMantidasInalteradas: qtdFolhasAntes === qtdFolhasDepois,
}, null, 2));

import { Lancamento, LancamentoFolha } from '../src/types';

// Mocks do cache local e das funções idênticas às implementadas em storage.ts
let cacheLancamentosFolha: LancamentoFolha[] = [];
let cacheLancamentos: Lancamento[] = [];

function getCategorias() {
  return [
    { id: 'cat-des-4', nome: 'Salários', tipo: 'despesa', cor: '#000' }
  ];
}

function getFuncionarioById(id: string) {
  return { id, nome: 'João Silva' };
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

function garantirDespesaDaFolha(folha: LancamentoFolha): Lancamento | null {
  if (folha.tipo === 'desconto' || folha.status === 'cancelado') {
    return null;
  }

  const id = folha.lancamento_id || `desp-${folha.id}`;
  const despExistente = cacheLancamentos.find((l) => l.id === id);

  if (despExistente) {
    if (despExistente.status === 'pago') {
      if (folha.lancamento_id !== id) {
        saveLancamentoFolha({ ...folha, lancamento_id: id });
      }
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
    if (folha.lancamento_id !== id) {
      saveLancamentoFolha({ ...folha, lancamento_id: id });
    }
    return salva;
  }

  if (folha.status === 'pago') {
    return null;
  }

  const cats = getCategorias();
  const catSalarios = cats.find((c) => c.nome.toLowerCase() === 'salários' || c.nome.toLowerCase() === 'salarios');
  const categoriaId = catSalarios ? catSalarios.id : 'cat-des-4';

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
    categoria_id: categoriaId,
    forma_pagamento: 'transferencia',
    recorrencia: 'nenhuma',
    origem: 'folha',
    funcionario_id: folha.funcionario_id,
    folha_id: folha.id,
    criado_em: new Date().toISOString(),
  };

  const salva = saveLancamento(novaDespesa);
  if (folha.lancamento_id !== id) {
    saveLancamentoFolha({ ...folha, lancamento_id: id });
  }
  return salva;
}

console.log('--- TESTES CONFERÊNCIA PARTE 2A ---');

// Cenário a: folha de salário pendente → despesa criada com id `desp-<id>`, status pendente, valor igual ao da folha, origem 'folha', folha_id preenchido
cacheLancamentosFolha = [];
cacheLancamentos = [];
const folhaA: LancamentoFolha = {
  id: 'folha-sal-1',
  funcionario_id: 'func-1',
  tipo: 'salario',
  descricao: 'Salário Mensal Eletricista',
  competencia: '10/2026',
  valor: 3500,
  tipo_operacao: 'provento',
  data_prevista: '2026-10-05',
  data_pagamento: null,
  status: 'pendente',
  conta_id: 'conta-1',
  criado_em: new Date().toISOString(),
};
saveLancamentoFolha(folhaA);
const despA = garantirDespesaDaFolha(folhaA);
console.log('Cenário a:', JSON.stringify({
  despesaCriada: !!despA,
  id: despA?.id,
  status: despA?.status,
  valor: despA?.valor,
  origem: despA?.origem,
  folha_id: despA?.folha_id,
  qtdDespesasNoCache: cacheLancamentos.length,
}, null, 2));

// Cenário b: chamar garantirDespesaDaFolha duas vezes → continua 1 despesa só
const despA2 = garantirDespesaDaFolha(folhaA);
console.log('Cenário b (segunda chamada):', JSON.stringify({
  mesmoId: despA2?.id === despA?.id,
  qtdDespesasNoCache: cacheLancamentos.length,
}, null, 2));

// Cenário c: folha tipo 'desconto' → retorna null e nenhuma despesa criada
const folhaC: LancamentoFolha = {
  id: 'folha-desc-1',
  funcionario_id: 'func-1',
  tipo: 'desconto',
  descricao: 'Falta Injustificada',
  competencia: '10/2026',
  valor: 150,
  tipo_operacao: 'desconto',
  data_prevista: '2026-10-05',
  data_pagamento: null,
  status: 'pendente',
  conta_id: 'conta-1',
  criado_em: new Date().toISOString(),
};
saveLancamentoFolha(folhaC);
const despC = garantirDespesaDaFolha(folhaC);
console.log('Cenário c (tipo desconto):', JSON.stringify({
  retornoNull: despC === null,
  qtdDespesasNoCache: cacheLancamentos.length,
}, null, 2));

// Cenário d: folha 'pago' sem despesa → retorna null e nenhuma despesa criada
const folhaD: LancamentoFolha = {
  id: 'folha-sal-antiga',
  funcionario_id: 'func-1',
  tipo: 'salario',
  descricao: 'Salário Antigo Quitado',
  competencia: '09/2026',
  valor: 3500,
  tipo_operacao: 'provento',
  data_prevista: '2026-09-05',
  data_pagamento: '2026-09-05',
  status: 'pago',
  conta_id: 'conta-1',
  criado_em: new Date().toISOString(),
};
saveLancamentoFolha(folhaD);
const despD = garantirDespesaDaFolha(folhaD);
console.log('Cenário d (folha pago sem despesa):', JSON.stringify({
  retornoNull: despD === null,
  qtdDespesasNoCache: cacheLancamentos.length,
}, null, 2));

// Cenário e: despesa já 'pago' → não é alterada
const folhaE: LancamentoFolha = {
  id: 'folha-sal-quitada',
  funcionario_id: 'func-1',
  tipo: 'salario',
  descricao: 'Salário Quitado',
  competencia: '10/2026',
  valor: 4000,
  tipo_operacao: 'provento',
  data_prevista: '2026-10-05',
  data_pagamento: '2026-10-05',
  status: 'pago',
  conta_id: 'conta-1',
  lancamento_id: 'desp-folha-sal-quitada',
  criado_em: new Date().toISOString(),
};
const despEOriginal: Lancamento = {
  id: 'desp-folha-sal-quitada',
  tipo: 'despesa',
  descricao: 'Folha: Salário Quitado – João Silva (10/2026)',
  valor: 4000,
  data_vencimento: '2026-10-05',
  data_pagamento: '2026-10-05',
  status: 'pago',
  conta_id: 'conta-1',
  categoria_id: 'cat-des-4',
  forma_pagamento: 'transferencia',
  recorrencia: 'nenhuma',
  origem: 'folha',
  funcionario_id: 'func-1',
  folha_id: 'folha-sal-quitada',
  criado_em: new Date().toISOString(),
};
saveLancamento(despEOriginal);
saveLancamentoFolha(folhaE);

folhaE.valor = 5000;
const despE = garantirDespesaDaFolha(folhaE);
console.log('Cenário e (despesa já pago):', JSON.stringify({
  status: despE?.status,
  valorPermaneceuInalterado: despE?.valor === 4000,
}, null, 2));

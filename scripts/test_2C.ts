import { Lancamento, LancamentoFolha } from '../src/types';

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

let contadorAuditoria = 0;
function registrarAuditoria(modulo: string, acao: string, descricao: string) {
  if (acao === 'exclusao') contadorAuditoria++;
}

function removerRegistroFolhaBruto(id: string): void {
  cacheLancamentosFolha = cacheLancamentosFolha.filter((l) => l.id !== id);
}

function removerFolhaOrfa(folhaId: string): void {
  const folha = cacheLancamentosFolha.find((l) => l.id === folhaId);

  const adiantamentosComAbatimento = cacheLancamentosFolha.filter(
    (l) => l.tipo === 'adiantamento' && (l.abatimentos || []).some((a) => a.folha_id === folhaId)
  );

  for (const ad of adiantamentosComAbatimento) {
    const novosAbatimentos = (ad.abatimentos || []).filter((a) => a.folha_id !== folhaId);
    const somaAbatimentos = novosAbatimentos.reduce((sum, a) => sum + a.valor, 0);
    const saldoEmAberto = +(ad.valor - somaAbatimentos).toFixed(2);
    const descontadoTotal = saldoEmAberto <= 0.001;

    saveLancamentoFolha({
      ...ad,
      abatimentos: novosAbatimentos,
      descontado_em_folha: descontadoTotal,
    });
  }

  removerRegistroFolhaBruto(folhaId);

  if (folha) {
    const func = getFuncionarioById(folha.funcionario_id);
    const nomeDoFuncionario = func ? func.nome : '';
    registrarAuditoria(
      'folha',
      'exclusao',
      `Exclusão da folha: ${folha.descricao} – ${nomeDoFuncionario} (${folha.competencia}) no valor de R$ ${folha.valor.toFixed(2)}`
    );
  }
}

function deleteLancamento(id: string): void {
  const target = cacheLancamentos.find((l) => l.id === id);
  cacheLancamentos = cacheLancamentos.filter((l) => l.id !== id);

  if (target?.origem === 'folha' && target.folha_id) {
    removerFolhaOrfa(target.folha_id);
  }
}

function excluirLancamentoFolha(id: string): void {
  const folha = cacheLancamentosFolha.find((l) => l.id === id);
  if (!folha) return;

  if (folha.lancamento_id && cacheLancamentos.some((l) => l.id === folha.lancamento_id)) {
    deleteLancamento(folha.lancamento_id);
  } else {
    removerFolhaOrfa(id);
  }
}

function deleteLancamentoFolha(id: string): void {
  excluirLancamentoFolha(id);
}

console.log('--- TESTES CONFERÊNCIA PARTE 2C ---');

// Cenário a: adiantamento pago de 5.000 abatido 4.160 por um salário; excluirLancamentoFolha(salário) → adiantamento volta a saldo 5.000, descontado_em_folha=false, salário e despesa removidos
cacheLancamentosFolha = [];
cacheLancamentos = [];
const adiantamentoA: LancamentoFolha = {
  id: 'ad-1',
  funcionario_id: 'func-1',
  tipo: 'adiantamento',
  descricao: 'Adiantamento Quinzena',
  competencia: '10/2026',
  valor: 5000,
  tipo_operacao: 'provento',
  data_prevista: '2026-10-15',
  data_pagamento: '2026-10-15',
  status: 'pago',
  conta_id: 'conta-1',
  descontado_em_folha: true,
  abatimentos: [{ folha_id: 'sal-1', valor: 4160 }],
  criado_em: new Date().toISOString(),
};
const salarioA: LancamentoFolha = {
  id: 'sal-1',
  funcionario_id: 'func-1',
  tipo: 'salario',
  descricao: 'Salário Mensal',
  competencia: '10/2026',
  valor: 3840,
  tipo_operacao: 'provento',
  data_prevista: '2026-10-30',
  data_pagamento: null,
  status: 'pendente',
  conta_id: 'conta-1',
  lancamento_id: 'desp-sal-1',
  criado_em: new Date().toISOString(),
};
const despesaA: Lancamento = {
  id: 'desp-sal-1',
  tipo: 'despesa',
  descricao: 'Folha: Salário Mensal',
  valor: 3840,
  data_vencimento: '2026-10-30',
  data_pagamento: null,
  status: 'pendente',
  conta_id: 'conta-1',
  categoria_id: 'cat-des-4',
  forma_pagamento: 'transferencia',
  recorrencia: 'nenhuma',
  origem: 'folha',
  funcionario_id: 'func-1',
  folha_id: 'sal-1',
  criado_em: new Date().toISOString(),
};
saveLancamentoFolha(adiantamentoA);
saveLancamentoFolha(salarioA);
saveLancamento(despesaA);

excluirLancamentoFolha('sal-1');

const adAAtual = cacheLancamentosFolha.find((l) => l.id === 'ad-1');
const somaAbatimentosA = (adAAtual?.abatimentos || []).reduce((acc, x) => acc + x.valor, 0);
const saldoA = (adAAtual?.valor || 0) - somaAbatimentosA;

console.log('Cenário a:', JSON.stringify({
  adSaldoRemanescente: saldoA,
  descontadoEmFolha: adAAtual?.descontado_em_folha,
  salarioExiste: !!cacheLancamentosFolha.find((l) => l.id === 'sal-1'),
  despesaExiste: !!cacheLancamentos.find((l) => l.id === 'desp-sal-1'),
}, null, 2));

// Cenário b: mesmo setup, mas excluindo pela despesa: deleteLancamento(despesa) → a folha some e a reversão ocorre UMA só vez (saldo do adiantamento = 5.000, nunca maior)
cacheLancamentosFolha = [];
cacheLancamentos = [];
contadorAuditoria = 0;
saveLancamentoFolha({ ...adiantamentoA, descontado_em_folha: true, abatimentos: [{ folha_id: 'sal-1', valor: 4160 }] });
saveLancamentoFolha(salarioA);
saveLancamento(despesaA);

deleteLancamento('desp-sal-1');

const adBAtual = cacheLancamentosFolha.find((l) => l.id === 'ad-1');
const somaAbatimentosB = (adBAtual?.abatimentos || []).reduce((acc, x) => acc + x.valor, 0);
const saldoB = (adBAtual?.valor || 0) - somaAbatimentosB;

console.log('Cenário b:', JSON.stringify({
  adSaldoRemanescente: saldoB,
  descontadoEmFolha: adBAtual?.descontado_em_folha,
  folhaExiste: !!cacheLancamentosFolha.find((l) => l.id === 'sal-1'),
  vezesAuditoriaExclusao: contadorAuditoria,
}, null, 2));

// Cenário c: excluir folha sem despesa vinculada (legado) → remove a folha e reverte abatimentos
cacheLancamentosFolha = [];
cacheLancamentos = [];
const salarioLegado: LancamentoFolha = {
  ...salarioA,
  id: 'sal-legado-1',
  lancamento_id: undefined,
};
saveLancamentoFolha({ ...adiantamentoA, id: 'ad-legado-1', descontado_em_folha: true, abatimentos: [{ folha_id: 'sal-legado-1', valor: 4160 }] });
saveLancamentoFolha(salarioLegado);

excluirLancamentoFolha('sal-legado-1');

const adCAtual = cacheLancamentosFolha.find((l) => l.id === 'ad-legado-1');
const somaAbatimentosC = (adCAtual?.abatimentos || []).reduce((acc, x) => acc + x.valor, 0);
const saldoC = (adCAtual?.valor || 0) - somaAbatimentosC;

console.log('Cenário c (legado):', JSON.stringify({
  adSaldoRemanescente: saldoC,
  descontadoEmFolha: adCAtual?.descontado_em_folha,
  folhaExiste: !!cacheLancamentosFolha.find((l) => l.id === 'sal-legado-1'),
}, null, 2));

// Cenário d: deleteLancamento em despesa que NÃO é de folha → nada em folha é tocado
cacheLancamentosFolha = [];
cacheLancamentos = [];
saveLancamentoFolha(adiantamentoA);
const despNormal: Lancamento = {
  id: 'desp-norm-1',
  tipo: 'despesa',
  descricao: 'Fornecedor X',
  valor: 1200,
  data_vencimento: '2026-10-20',
  data_pagamento: null,
  status: 'pendente',
  conta_id: 'conta-1',
  categoria_id: 'cat-des-1',
  forma_pagamento: 'PIX',
  recorrencia: 'nenhuma',
  origem: 'manual',
  criado_em: new Date().toISOString(),
};
saveLancamento(despNormal);

const qtdFolhaAntes = cacheLancamentosFolha.length;
deleteLancamento('desp-norm-1');
const qtdFolhaDepois = cacheLancamentosFolha.length;

console.log('Cenário d (despesa manual):', JSON.stringify({
  despesaExiste: !!cacheLancamentos.find((l) => l.id === 'desp-norm-1'),
  folhaInalterada: qtdFolhaAntes === qtdFolhaDepois,
}, null, 2));

// MT Solar - Gestão Financeira
// Testes da Parte 23A: Função pura selecionarParaExcluir (escopo de exclusão de lançamentos)

import { selecionarParaExcluir } from '../src/utils/recorrencia';
import { Lancamento } from '../src/types';

let totalAssercoes = 0;

function asserir(condicao: boolean, mensagem: string) {
  totalAssercoes++;
  if (!condicao) {
    throw new Error(`❌ FALHA NA ASSERÇÃO: ${mensagem}`);
  }
}

function arraysIguais(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

function criarLancamentoFicticio(params: Partial<Lancamento> & { id: string; descricao: string; valor: number; data_vencimento: string }): Lancamento {
  const padrao: Omit<Lancamento, 'id' | 'descricao' | 'valor' | 'data_vencimento'> = {
    tipo: 'despesa',
    data_pagamento: params.status === 'pago' ? (params.data_pagamento || params.data_vencimento) : null,
    status: 'pendente',
    conta_id: 'conta-1',
    categoria_id: 'cat-1',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-01-01T00:00:00.000Z',
  };
  return {
    ...padrao,
    ...params,
  };
}

async function executarTestes() {
  console.log('🧪 Iniciando testes da PARTE 23A — Seleção para Exclusão Escopada (Função Pura)\n');

  // =========================================================================
  // BLOCO 1: Alvo sem grupo
  // =========================================================================
  console.log('--- BLOCO 1: Alvo sem grupo ---');

  const lAvulso1 = criarLancamentoFicticio({
    id: 'avulso-1',
    descricao: 'Material avulso',
    valor: 150,
    data_vencimento: '2026-03-10',
    status: 'pendente',
  });

  const lAvulso2 = criarLancamentoFicticio({
    id: 'avulso-2',
    descricao: 'Ferramentas',
    valor: 300,
    data_vencimento: '2026-03-20',
    status: 'pendente',
  });

  const listaAvulsos = [lAvulso1, lAvulso2];

  const resSoEstaAvulso = selecionarParaExcluir(listaAvulsos, 'avulso-1', 'so_esta');
  asserir(arraysIguais(resSoEstaAvulso, ['avulso-1']), 'Alvo sem grupo com escopo "so_esta" deve retornar apenas [alvo]');

  const resFuturasAvulso = selecionarParaExcluir(listaAvulsos, 'avulso-1', 'futuras');
  asserir(arraysIguais(resFuturasAvulso, ['avulso-1']), 'Alvo sem grupo com escopo "futuras" deve retornar apenas [alvo]');

  const resTodasAvulso = selecionarParaExcluir(listaAvulsos, 'avulso-1', 'todas');
  asserir(arraysIguais(resTodasAvulso, ['avulso-1']), 'Alvo sem grupo com escopo "todas" deve retornar apenas [alvo]');

  const resInexistente = selecionarParaExcluir(listaAvulsos, 'inexistente', 'todas');
  asserir(resInexistente.length === 0, 'Alvo inexistente deve retornar array vazio');

  console.log('✅ BLOCO 1 aprovado com sucesso.\n');

  // =========================================================================
  // BLOCO 2: Grupo com 5 membros (2 pagos e 3 pendentes) em cada escopo
  // =========================================================================
  console.log('--- BLOCO 2: Grupo com 5 membros (2 pagos e 3 pendentes) em cada escopo ---');

  const grupoRecId = 'grp-rec-mensal-1';

  const l1_pago = criarLancamentoFicticio({
    id: 'L1',
    descricao: 'Aluguel Galpão (1/5)',
    valor: 1000,
    data_vencimento: '2026-01-10',
    status: 'pago',
    recorrencia: 'mensal',
    grupo_recorrencia_id: grupoRecId,
  });

  const l2_pago = criarLancamentoFicticio({
    id: 'L2',
    descricao: 'Aluguel Galpão (2/5)',
    valor: 1000,
    data_vencimento: '2026-02-10',
    status: 'pago',
    recorrencia: 'mensal',
    grupo_recorrencia_id: grupoRecId,
  });

  const l3_alvo = criarLancamentoFicticio({
    id: 'L3',
    descricao: 'Aluguel Galpão (3/5)',
    valor: 1000,
    data_vencimento: '2026-03-10',
    status: 'pendente',
    recorrencia: 'mensal',
    grupo_recorrencia_id: grupoRecId,
  });

  const l4_pend = criarLancamentoFicticio({
    id: 'L4',
    descricao: 'Aluguel Galpão (4/5)',
    valor: 1000,
    data_vencimento: '2026-04-10',
    status: 'pendente',
    recorrencia: 'mensal',
    grupo_recorrencia_id: grupoRecId,
  });

  const l5_pend = criarLancamentoFicticio({
    id: 'L5',
    descricao: 'Aluguel Galpão (5/5)',
    valor: 1000,
    data_vencimento: '2026-05-10',
    status: 'pendente',
    recorrencia: 'mensal',
    grupo_recorrencia_id: grupoRecId,
  });

  const grupoRecorrencia5 = [l1_pago, l2_pago, l3_alvo, l4_pend, l5_pend];

  // Escopo: so_esta
  const resSoEstaL3 = selecionarParaExcluir(grupoRecorrencia5, 'L3', 'so_esta');
  asserir(arraysIguais(resSoEstaL3, ['L3']), 'Escopo "so_esta" no alvo L3 deve retornar somente ["L3"]');

  // Escopo: futuras
  const resFuturasL3 = selecionarParaExcluir(grupoRecorrencia5, 'L3', 'futuras');
  asserir(arraysIguais(resFuturasL3, ['L3', 'L4', 'L5']), 'Escopo "futuras" no alvo L3 deve retornar ["L3", "L4", "L5"]');
  asserir(!resFuturasL3.includes('L1'), 'Escopo "futuras" não pode conter L1 (pago e anterior)');
  asserir(!resFuturasL3.includes('L2'), 'Escopo "futuras" não pode conter L2 (pago e anterior)');

  // Escopo: todas
  const resTodasL3 = selecionarParaExcluir(grupoRecorrencia5, 'L3', 'todas');
  asserir(arraysIguais(resTodasL3, ['L3', 'L4', 'L5']), 'Escopo "todas" no alvo L3 deve retornar ["L3", "L4", "L5"] (pagos são mantidos)');
  asserir(!resTodasL3.includes('L1'), 'Escopo "todas" não pode conter L1 já pago');
  asserir(!resTodasL3.includes('L2'), 'Escopo "todas" não pode conter L2 já pago');

  console.log('✅ BLOCO 2 aprovado com sucesso.\n');

  // =========================================================================
  // BLOCO 3: Alvo pago
  // =========================================================================
  console.log('--- BLOCO 3: Alvo já pago ---');

  // O usuário escolheu o próprio L2 (que já está pago)
  const resSoEstaL2Pago = selecionarParaExcluir(grupoRecorrencia5, 'L2', 'so_esta');
  asserir(arraysIguais(resSoEstaL2Pago, ['L2']), 'Alvo pago com escopo "so_esta" deve retornar [L2]');

  const resFuturasL2Pago = selecionarParaExcluir(grupoRecorrencia5, 'L2', 'futuras');
  asserir(arraysIguais(resFuturasL2Pago, ['L2', 'L3', 'L4', 'L5']), 'Alvo pago com escopo "futuras" inclui alvo L2 + membros pendentes com vencimento > L2');
  asserir(!resFuturasL2Pago.includes('L1'), 'L1 pago com vencimento anterior não é incluído em futuras');

  const resTodasL2Pago = selecionarParaExcluir(grupoRecorrencia5, 'L2', 'todas');
  asserir(arraysIguais(resTodasL2Pago, ['L2', 'L3', 'L4', 'L5']), 'Alvo pago com escopo "todas" inclui alvo L2 + todos os membros pendentes do grupo');
  asserir(!resTodasL2Pago.includes('L1'), 'L1 que é outro membro já pago NÃO é incluído em "todas"');

  console.log('✅ BLOCO 3 aprovado com sucesso.\n');

  // =========================================================================
  // BLOCO 4: Membros de origem 'folha' ou 'transferencia' preservados
  // =========================================================================
  console.log('--- BLOCO 4: Membros de origem folha ou transferencia preservados ---');

  const lFolha = criarLancamentoFicticio({
    id: 'L-FOLHA',
    descricao: 'Adiantamento Quinzenal (Folha)',
    valor: 800,
    data_vencimento: '2026-04-05',
    status: 'pendente',
    origem: 'folha',
    grupo_recorrencia_id: grupoRecId,
  });

  const lTransf = criarLancamentoFicticio({
    id: 'L-TRANSF',
    descricao: 'Transferência entre contas vinculada',
    valor: 500,
    data_vencimento: '2026-04-15',
    status: 'pendente',
    origem: 'transferencia',
    grupo_recorrencia_id: grupoRecId,
  });

  const grupoComEspeciais = [...grupoRecorrencia5, lFolha, lTransf];

  const resFuturasEspeciais = selecionarParaExcluir(grupoComEspeciais, 'L3', 'futuras');
  asserir(arraysIguais(resFuturasEspeciais, ['L3', 'L4', 'L5']), 'Membros de origem folha e transferencia NÃO entram no escopo "futuras"');
  asserir(!resFuturasEspeciais.includes('L-FOLHA'), 'L-FOLHA não pode ser selecionado');
  asserir(!resFuturasEspeciais.includes('L-TRANSF'), 'L-TRANSF não pode ser selecionado');

  const resTodasEspeciais = selecionarParaExcluir(grupoComEspeciais, 'L3', 'todas');
  asserir(arraysIguais(resTodasEspeciais, ['L3', 'L4', 'L5']), 'Membros de origem folha e transferencia NÃO entram no escopo "todas"');
  asserir(!resTodasEspeciais.includes('L-FOLHA'), 'L-FOLHA não pode ser selecionado');
  asserir(!resTodasEspeciais.includes('L-TRANSF'), 'L-TRANSF não pode ser selecionado');

  console.log('✅ BLOCO 4 aprovado com sucesso.\n');

  // =========================================================================
  // BLOCO 5: Grupo de parcelas (grupo_parcelas_id)
  // =========================================================================
  console.log('--- BLOCO 5: Grupo de parcelas e grupo de recorrência ---');

  const grupoParcId = 'grp-parc-solar-2026';

  const p1_paga = criarLancamentoFicticio({
    id: 'P1',
    descricao: 'Instalação Solar (1/4)',
    valor: 2500,
    data_vencimento: '2026-01-20',
    status: 'pago',
    recorrencia: 'parcelado',
    grupo_parcelas_id: grupoParcId,
  });

  const p2_pend = criarLancamentoFicticio({
    id: 'P2',
    descricao: 'Instalação Solar (2/4)',
    valor: 2500,
    data_vencimento: '2026-02-20',
    status: 'pendente',
    recorrencia: 'parcelado',
    grupo_parcelas_id: grupoParcId,
  });

  const p3_pend = criarLancamentoFicticio({
    id: 'P3',
    descricao: 'Instalação Solar (3/4)',
    valor: 2500,
    data_vencimento: '2026-03-20',
    status: 'pendente',
    recorrencia: 'parcelado',
    grupo_parcelas_id: grupoParcId,
  });

  const p4_pend = criarLancamentoFicticio({
    id: 'P4',
    descricao: 'Instalação Solar (4/4)',
    valor: 2500,
    data_vencimento: '2026-04-20',
    status: 'pendente',
    recorrencia: 'parcelado',
    grupo_parcelas_id: grupoParcId,
  });

  const grupoParcelas = [p1_paga, p2_pend, p3_pend, p4_pend];

  // Escopo so_esta
  const resSoEstaP2 = selecionarParaExcluir(grupoParcelas, 'P2', 'so_esta');
  asserir(arraysIguais(resSoEstaP2, ['P2']), 'Parcelas: escopo "so_esta" retorna apenas [P2]');

  // Escopo futuras
  const resFuturasP2 = selecionarParaExcluir(grupoParcelas, 'P2', 'futuras');
  asserir(arraysIguais(resFuturasP2, ['P2', 'P3', 'P4']), 'Parcelas: escopo "futuras" retorna [P2, P3, P4]');
  asserir(!resFuturasP2.includes('P1'), 'Parcelas: P1 paga não entra em futuras');

  // Escopo todas
  const resTodasP2 = selecionarParaExcluir(grupoParcelas, 'P2', 'todas');
  asserir(arraysIguais(resTodasP2, ['P2', 'P3', 'P4']), 'Parcelas: escopo "todas" retorna [P2, P3, P4] (P1 mantida)');
  asserir(!resTodasP2.includes('P1'), 'Parcelas: P1 paga não entra em todas');

  console.log('✅ BLOCO 5 aprovado com sucesso.\n');

  // =========================================================================
  // BLOCO 6: Validação de ausência de duplicatas
  // =========================================================================
  console.log('--- BLOCO 6: Ausência de IDs repetidos ---');

  const listaComDuplicidadeNaColecao = [
    l3_alvo,
    l4_pend,
    l4_pend, // objeto repetido na array
    l5_pend,
  ];

  const resDedupe = selecionarParaExcluir(listaComDuplicidadeNaColecao, 'L3', 'todas');
  const setUnicos = new Set(resDedupe);
  asserir(setUnicos.size === resDedupe.length, 'Não deve haver duplicatas no array retornado');
  asserir(arraysIguais(resDedupe, ['L3', 'L4', 'L5']), 'Array deduplicado corretamente');

  console.log('✅ BLOCO 6 aprovado com sucesso.\n');

  console.log(`🎉 TODOS OS TESTES DA PARTE 23A PASSARAM COM SUCESSO! (${totalAssercoes} asserções)`);
}

executarTestes().catch((err) => {
  console.error(err);
  process.exit(1);
});

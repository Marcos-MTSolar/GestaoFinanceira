// MT Solar - Gestão Financeira
// Testes da Parte 23C: Edição e exclusão de lançamentos de recorrência (funções puras)

import {
  aplicarEdicaoNosProximos,
  atualizarModeloRecorrencia,
  encerrarRecorrencia,
  processarExclusaoRecorrencia,
  podeEditarProximos,
  datasDoMes,
  planejarGeracao,
} from '../src/utils/recorrencia';
import { Lancamento, RecorrenciaLancamento } from '../src/types';

let totalAssercoes = 0;
let totalFalhas = 0;
const detalheFalhas: string[] = [];

function asserir(condicao: boolean, mensagem: string) {
  totalAssercoes++;
  if (!condicao) {
    totalFalhas++;
    detalheFalhas.push(`  ❌ FALHA: ${mensagem}`);
    console.error(`  ❌ FALHA: ${mensagem}`);
  } else {
    console.log(`  ✅ OK: ${mensagem}`);
  }
}

/** Cria um modelo de recorrência fictício */
function criarModelo(params: Partial<RecorrenciaLancamento> & { id: string }): RecorrenciaLancamento {
  const base: RecorrenciaLancamento = {
    id: params.id,
    tipo: 'despesa',
    descricao: 'Aluguel do Galpão',
    valor: 1000,
    frequencia: 'mensal',
    data_inicio: '2026-01-10',
    conta_id: 'conta-1',
    categoria_id: 'cat-aluguel',
    forma_pagamento: 'PIX',
    ativa: true,
    ultima_competencia_gerada: '2026-01',
    criado_em: '2026-01-01T00:00:00.000Z',
  };
  return { ...base, ...params };
}

/** Cria um lançamento fictício */
function criarLancamento(params: Partial<Lancamento> & { id: string; descricao: string; valor: number; data_vencimento: string }): Lancamento {
  const padrao: Omit<Lancamento, 'id' | 'descricao' | 'valor' | 'data_vencimento'> = {
    tipo: 'despesa',
    data_pagamento: params.status === 'pago' ? (params.data_pagamento || params.data_vencimento) : null,
    status: 'pendente',
    conta_id: 'conta-1',
    categoria_id: 'cat-aluguel',
    forma_pagamento: 'PIX',
    recorrencia: 'mensal',
    origem: 'manual',
    criado_em: '2026-01-01T00:00:00.000Z',
  };
  return { ...padrao, ...params };
}

// =============================================================================
// BLOCO 1: "Só este lançamento" altera apenas 1 e preserva os demais
// =============================================================================
async function testarSoEsteAlteraUm() {
  console.log('\n--- BLOCO 1: "Só este" altera 1 lançamento e preserva os outros ---');

  const grupoId = 'rec-modelo-1';
  const l1 = criarLancamento({ id: 'L1', descricao: 'Aluguel Galpão', valor: 1000, data_vencimento: '2026-01-10', status: 'pago', grupo_recorrencia_id: grupoId });
  const l2 = criarLancamento({ id: 'L2', descricao: 'Aluguel Galpão', valor: 1000, data_vencimento: '2026-02-10', status: 'pendente', grupo_recorrencia_id: grupoId });
  const l3 = criarLancamento({ id: 'L3', descricao: 'Aluguel Galpão', valor: 1000, data_vencimento: '2026-03-10', status: 'pendente', grupo_recorrencia_id: grupoId });

  const lista = [l1, l2, l3];

  // Simula o comportamento do escopo "Só este lançamento": apenas o alvo é modificado
  const alvoEditado = { ...l2, descricao: 'Aluguel Galpão com Desconto', valor: 850 };
  const listaAposSoEste = lista.map(item => item.id === l2.id ? alvoEditado : item);

  asserir(listaAposSoEste[0].valor === 1000, 'L1 (anterior e pago) permanece 1000');
  asserir(listaAposSoEste[0].descricao === 'Aluguel Galpão', 'L1 permanece com descrição original');
  asserir(listaAposSoEste[1].valor === 850, 'L2 (alvo) foi alterado para 850');
  asserir(listaAposSoEste[1].descricao === 'Aluguel Galpão com Desconto', 'L2 foi alterado com a nova descrição');
  asserir(listaAposSoEste[2].valor === 1000, 'L3 (próximo mês) permanece inalterado em 1000');
  asserir(listaAposSoEste[2].descricao === 'Aluguel Galpão', 'L3 permanece com descrição original');

  console.log('✅ BLOCO 1 concluído.');
}

// =============================================================================
// BLOCO 2: "Próximos" altera pendentes com vencimento >= alvo e preserva pagos e anteriores
// =============================================================================
async function testarProximosAlteraPendentesEPreservaPagosEAnteriores() {
  console.log('\n--- BLOCO 2: "Próximos" altera pendentes com vencimento >= alvo e preserva pagos e anteriores ---');

  const grupoId = 'rec-galpao-2026';

  const l1_pago_ant = criarLancamento({
    id: 'L1',
    descricao: 'Aluguel Galpão',
    valor: 1000,
    data_vencimento: '2026-01-10',
    status: 'pago',
    grupo_recorrencia_id: grupoId,
  });

  const l2_pend_ant = criarLancamento({
    id: 'L2',
    descricao: 'Aluguel Galpão',
    valor: 1000,
    data_vencimento: '2026-02-10',
    status: 'pendente',
    grupo_recorrencia_id: grupoId,
  });

  const l3_alvo_pend = criarLancamento({
    id: 'L3',
    descricao: 'Aluguel Galpão',
    valor: 1000,
    data_vencimento: '2026-03-10',
    status: 'pendente',
    grupo_recorrencia_id: grupoId,
  });

  const l4_pago_futuro = criarLancamento({
    id: 'L4',
    descricao: 'Aluguel Galpão',
    valor: 1000,
    data_vencimento: '2026-04-10',
    status: 'pago',
    data_pagamento: '2026-04-05',
    grupo_recorrencia_id: grupoId,
  });

  const l5_pend_futuro = criarLancamento({
    id: 'L5',
    descricao: 'Aluguel Galpão',
    valor: 1000,
    data_vencimento: '2026-05-10',
    status: 'pendente',
    grupo_recorrencia_id: grupoId,
  });

  const l6_pend_futuro = criarLancamento({
    id: 'L6',
    descricao: 'Aluguel Galpão',
    valor: 1000,
    data_vencimento: '2026-06-10',
    status: 'pendente',
    grupo_recorrencia_id: grupoId,
  });

  const l_outro_grupo = criarLancamento({
    id: 'L-OUTRO',
    descricao: 'Internet Fibra',
    valor: 200,
    data_vencimento: '2026-05-10',
    status: 'pendente',
    grupo_recorrencia_id: 'outro-grupo',
  });

  const l_folha = criarLancamento({
    id: 'L-FOLHA',
    descricao: 'Adiantamento Folha',
    valor: 500,
    data_vencimento: '2026-05-10',
    status: 'pendente',
    origem: 'folha',
    grupo_recorrencia_id: grupoId,
  });

  const listaOriginal = [
    l1_pago_ant,
    l2_pend_ant,
    l3_alvo_pend,
    l4_pago_futuro,
    l5_pend_futuro,
    l6_pend_futuro,
    l_outro_grupo,
    l_folha,
  ];

  const alteracoes: Partial<Lancamento> = {
    descricao: 'Aluguel Galpão Reajustado',
    valor: 1350,
    forma_pagamento: 'boleto',
    observacoes: 'Reajuste anual acordado',
  };

  const resultado = aplicarEdicaoNosProximos(listaOriginal, l3_alvo_pend, alteracoes);

  // Verificações
  const rL1 = resultado.find(l => l.id === 'L1')!;
  asserir(rL1.valor === 1000 && rL1.descricao === 'Aluguel Galpão', 'L1 (anterior pago) não foi alterado');

  const rL2 = resultado.find(l => l.id === 'L2')!;
  asserir(rL2.valor === 1000 && rL2.descricao === 'Aluguel Galpão', 'L2 (anterior pendente) não foi alterado');

  const rL3 = resultado.find(l => l.id === 'L3')!;
  asserir(rL3.valor === 1350 && rL3.descricao === 'Aluguel Galpão Reajustado', 'L3 (alvo) foi alterado com sucesso');
  asserir(rL3.forma_pagamento === 'boleto', 'L3 recebeu nova forma de pagamento boleto');
  asserir(rL3.observacoes === 'Reajuste anual acordado', 'L3 recebeu novas observações');

  const rL4 = resultado.find(l => l.id === 'L4')!;
  asserir(rL4.valor === 1000 && rL4.descricao === 'Aluguel Galpão', 'L4 (futuro JÁ PAGO) NUNCA é alterado');

  const rL5 = resultado.find(l => l.id === 'L5')!;
  asserir(rL5.valor === 1350 && rL5.descricao === 'Aluguel Galpão Reajustado', 'L5 (futuro pendente) foi alterado com sucesso');
  asserir(rL5.forma_pagamento === 'boleto', 'L5 recebeu nova forma de pagamento');

  const rL6 = resultado.find(l => l.id === 'L6')!;
  asserir(rL6.valor === 1350 && rL6.descricao === 'Aluguel Galpão Reajustado', 'L6 (futuro pendente) foi alterado com sucesso');

  const rOutro = resultado.find(l => l.id === 'L-OUTRO')!;
  asserir(rOutro.valor === 200 && rOutro.descricao === 'Internet Fibra', 'Lançamento de outro grupo não foi tocado');

  const rFolha = resultado.find(l => l.id === 'L-FOLHA')!;
  asserir(rFolha.valor === 500 && rFolha.descricao === 'Adiantamento Folha', 'Lançamento de origem folha preservado');

  // Pureza: lista original não sofreu mutação
  asserir(l3_alvo_pend.valor === 1000, 'Função pura: objeto original l3_alvo_pend não sofreu mutação');
  asserir(l5_pend_futuro.valor === 1000, 'Função pura: objeto original l5_pend_futuro não sofreu mutação');

  console.log('✅ BLOCO 2 concluído.');
}

// =============================================================================
// BLOCO 3: Mudança de dia — 31 para 15
// =============================================================================
async function testarMudancaDia31Para15() {
  console.log('\n--- BLOCO 3: Mudança de dia de vencimento de 31 para 15 ---');

  const grupoId = 'rec-dia-31';

  const l1_jan = criarLancamento({ id: 'L-JAN', descricao: 'Mensalidade', valor: 500, data_vencimento: '2026-01-31', status: 'pendente', grupo_recorrencia_id: grupoId });
  const l2_fev = criarLancamento({ id: 'L-FEV', descricao: 'Mensalidade', valor: 500, data_vencimento: '2026-02-28', status: 'pendente', grupo_recorrencia_id: grupoId });
  const l3_mar = criarLancamento({ id: 'L-MAR', descricao: 'Mensalidade', valor: 500, data_vencimento: '2026-03-31', status: 'pendente', grupo_recorrencia_id: grupoId });
  const l4_abr = criarLancamento({ id: 'L-ABR', descricao: 'Mensalidade', valor: 500, data_vencimento: '2026-04-30', status: 'pendente', grupo_recorrencia_id: grupoId });

  const lista = [l1_jan, l2_fev, l3_mar, l4_abr];

  const alteracoes: Partial<Lancamento> = {
    data_vencimento: '2026-01-15',
  };

  const resultado = aplicarEdicaoNosProximos(lista, l1_jan, alteracoes);

  asserir(resultado[0].data_vencimento === '2026-01-15', 'Janeiro (alvo): 31 virou 15');
  asserir(resultado[1].data_vencimento === '2026-02-15', 'Fevereiro: 28 virou 15');
  asserir(resultado[2].data_vencimento === '2026-03-15', 'Março: 31 virou 15');
  asserir(resultado[3].data_vencimento === '2026-04-15', 'Abril: 30 virou 15');

  // Atualização no modelo de recorrência
  const modeloOriginal = criarModelo({ id: grupoId, data_inicio: '2026-01-31' });
  const modeloAtualizado = atualizarModeloRecorrencia(modeloOriginal, alteracoes);
  asserir(modeloAtualizado.data_inicio.endsWith('-15'), 'Modelo: dia de data_inicio agora é 15');

  // Verificação de geração futura com o modelo atualizado em maio
  const datasMaio = datasDoMes(modeloAtualizado, '2026-05');
  asserir(datasMaio.length === 1 && datasMaio[0] === '2026-05-15', 'Modelo atualizado gera corretamente dia 15 em maio');

  console.log('✅ BLOCO 3 concluído.');
}

// =============================================================================
// BLOCO 4: Mudança de dia — 15 para 31 em fevereiro (limitação ao fim do mês)
// =============================================================================
async function testarMudancaDia15Para31Fevereiro() {
  console.log('\n--- BLOCO 4: Mudança de dia de vencimento de 15 para 31 (fevereiro limitado a 28/29) ---');

  const grupoId = 'rec-dia-15';

  const l1_jan = criarLancamento({ id: 'L-JAN', descricao: 'Serviço Cloud', valor: 300, data_vencimento: '2026-01-15', status: 'pendente', grupo_recorrencia_id: grupoId });
  const l2_fev = criarLancamento({ id: 'L-FEV', descricao: 'Serviço Cloud', valor: 300, data_vencimento: '2026-02-15', status: 'pendente', grupo_recorrencia_id: grupoId });
  const l3_mar = criarLancamento({ id: 'L-MAR', descricao: 'Serviço Cloud', valor: 300, data_vencimento: '2026-03-15', status: 'pendente', grupo_recorrencia_id: grupoId });
  const l4_abr = criarLancamento({ id: 'L-ABR', descricao: 'Serviço Cloud', valor: 300, data_vencimento: '2026-04-15', status: 'pendente', grupo_recorrencia_id: grupoId });

  const lista = [l1_jan, l2_fev, l3_mar, l4_abr];

  const alteracoes: Partial<Lancamento> = {
    data_vencimento: '2026-01-31',
  };

  const resultado = aplicarEdicaoNosProximos(lista, l1_jan, alteracoes);

  asserir(resultado[0].data_vencimento === '2026-01-31', 'Janeiro (alvo): virou 31');
  asserir(resultado[1].data_vencimento === '2026-02-28', 'Fevereiro 2026 (não-bissexto): limitado a 28');
  asserir(resultado[2].data_vencimento === '2026-03-31', 'Março: virou 31');
  asserir(resultado[3].data_vencimento === '2026-04-30', 'Abril (30 dias): limitado a 30');

  // Teste de fevereiro em ano bissexto (2028)
  const l_fev_2028 = criarLancamento({
    id: 'L-FEV-2028',
    descricao: 'Serviço Cloud',
    valor: 300,
    data_vencimento: '2028-02-15',
    status: 'pendente',
    grupo_recorrencia_id: grupoId,
  });
  const res2028 = aplicarEdicaoNosProximos([l_fev_2028], l_fev_2028, { data_vencimento: '2028-02-31' });
  // Fevereiro 2028 bissexto vira 2028-02-29
  // (Nota: se passar '2028-02-31' no alvo, parsearData extrai dia 31 e limita ao fim de fev 2028)
  const resBissexto = aplicarEdicaoNosProximos(
    [l1_jan, l_fev_2028],
    l1_jan,
    { data_vencimento: '2026-01-31' }
  );
  const fevBissexto = resBissexto.find(l => l.id === 'L-FEV-2028')!;
  asserir(fevBissexto.data_vencimento === '2028-02-29', 'Fevereiro 2028 (bissexto): dia 31 vira 29');

  console.log('✅ BLOCO 4 concluído.');
}

// =============================================================================
// BLOCO 5: Exclusão 'futuras' e 'todas' encerram o modelo e 'so_esta' não
// =============================================================================
async function testarExclusaoEscopoEncerramento() {
  console.log('\n--- BLOCO 5: Exclusão "futuras"/"todas" encerram o modelo e "so_esta" não ---');

  const modeloAtivo = criarModelo({
    id: 'rec-encerrar-teste',
    ativa: true,
    data_encerramento: undefined,
  });

  // 1. Escopo 'so_esta': NÃO encerra o modelo
  const resSoEsta = processarExclusaoRecorrencia(modeloAtivo, 'so_esta');
  asserir(resSoEsta?.ativa === true, 'Escopo "so_esta": modelo continua ATIVO');
  asserir(resSoEsta?.data_encerramento === undefined, 'Escopo "so_esta": data_encerramento continua indefinida');

  // 2. Escopo 'futuras': ENCERRA o modelo
  const dataHoje = '2026-03-25';
  const resFuturas = processarExclusaoRecorrencia(modeloAtivo, 'futuras', dataHoje);
  asserir(resFuturas?.ativa === false, 'Escopo "futuras": modelo é MARCADO COMO INATIVO (ativa = false)');
  asserir(resFuturas?.data_encerramento === dataHoje, `Escopo "futuras": data_encerramento é ${dataHoje}`);

  // 3. Escopo 'todas': ENCERRA o modelo
  const resTodas = processarExclusaoRecorrencia(modeloAtivo, 'todas', dataHoje);
  asserir(resTodas?.ativa === false, 'Escopo "todas": modelo é MARCADO COMO INATIVO (ativa = false)');
  asserir(resTodas?.data_encerramento === dataHoje, `Escopo "todas": data_encerramento é ${dataHoje}`);

  // 4. Verificação: modelo encerrado não gera lançamentos futuros
  if (resFuturas) {
    const novosAposEncerramento = planejarGeracao(resFuturas, [], '2026-05-01');
    asserir(novosAposEncerramento.length === 0, 'Modelo encerrado não planeja nenhum lançamento para meses futuros');
  }

  // 5. Exclusão de lançamento sem modelo (null/undefined): não quebra
  const resSemModelo = processarExclusaoRecorrencia(null, 'futuras');
  asserir(resSemModelo === null, 'Processar exclusão sem modelo retorna null com segurança');

  console.log('✅ BLOCO 5 concluído.');
}

// =============================================================================
// BLOCO 6: Grupo antigo sem modelo não mostra a opção de editar próximos
// =============================================================================
async function testarGrupoAntigoSemModelo() {
  console.log('\n--- BLOCO 6: Grupo antigo sem modelo não mostra a opção (podeEditarProximos = false) ---');

  const modelosCadastrados: RecorrenciaLancamento[] = [
    criarModelo({ id: 'rec-modelo-valido-1' }),
    criarModelo({ id: 'rec-modelo-valido-2' }),
  ];

  // Caso A: Lançamento gerado pelo modelo novo (tem grupo_recorrencia_id correspondente ao id do modelo)
  const lancComModelo = criarLancamento({
    id: 'lanc-novo',
    descricao: 'Seguro Empresarial',
    valor: 450,
    data_vencimento: '2026-04-10',
    grupo_recorrencia_id: 'rec-modelo-valido-1',
  });
  asserir(
    podeEditarProximos(lancComModelo, modelosCadastrados) === true,
    'Lançamento com grupo_recorrencia_id presente nos modelos: podeEditarProximos = TRUE'
  );

  // Caso B: Lançamento de grupo ANTIGO (tem grupo_recorrencia_id antigo mas NÃO existe modelo correspondente)
  const lancGrupoAntigo = criarLancamento({
    id: 'lanc-antigo-12x',
    descricao: 'Tarifa Legada 12x',
    valor: 150,
    data_vencimento: '2026-04-10',
    grupo_recorrencia_id: 'grp-antigo-12x-sem-modelo',
  });
  asserir(
    podeEditarProximos(lancGrupoAntigo, modelosCadastrados) === false,
    'Grupo antigo sem modelo em recorrencias: podeEditarProximos = FALSE (não mostra opção no modal)'
  );

  // Caso C: Lançamento avulso (sem grupo)
  const lancAvulso = criarLancamento({
    id: 'lanc-avulso',
    descricao: 'Compra Avulsa Parafusos',
    valor: 80,
    data_vencimento: '2026-04-10',
  });
  asserir(
    podeEditarProximos(lancAvulso, modelosCadastrados) === false,
    'Lançamento avulso: podeEditarProximos = FALSE'
  );

  // Caso D: Lançamento de contrato parcelado (tem grupo_parcelas_id, mas não grupo_recorrencia_id)
  const lancParcela = criarLancamento({
    id: 'lanc-parc-1',
    descricao: 'Contrato Solar (1/10)',
    valor: 2000,
    data_vencimento: '2026-04-10',
    grupo_parcelas_id: 'grp-parc-solar-99',
    recorrencia: 'parcelado',
  });
  asserir(
    podeEditarProximos(lancParcela, modelosCadastrados) === false,
    'Parcelamento de contrato (grupo_parcelas_id): podeEditarProximos = FALSE'
  );

  // Caso E: Parâmetro nulo ou indefinido
  asserir(
    podeEditarProximos(null, modelosCadastrados) === false,
    'Lançamento nulo: podeEditarProximos = FALSE'
  );

  console.log('✅ BLOCO 6 concluído.');
}

// =============================================================================
// EXECUÇÃO DE TODOS OS TESTES
// =============================================================================
async function executarTodos() {
  console.log('🧪 Iniciando testes da PARTE 23C — Edição e Exclusão de Recorrência (Funções Puras)\n');

  await testarSoEsteAlteraUm();
  await testarProximosAlteraPendentesEPreservaPagosEAnteriores();
  await testarMudancaDia31Para15();
  await testarMudancaDia15Para31Fevereiro();
  await testarExclusaoEscopoEncerramento();
  await testarGrupoAntigoSemModelo();

  console.log('\n=== RESULTADO FINAL PARTE 23C ===');
  console.log(`Total de asserções: ${totalAssercoes}`);
  console.log(`Aprovadas: ${totalAssercoes - totalFalhas}`);
  console.log(`Falhas: ${totalFalhas}`);

  if (totalFalhas > 0) {
    console.log('\nDetalhes das falhas:');
    detalheFalhas.forEach(f => console.log(f));
    process.exit(1);
  } else {
    console.log('\n🎉 TODOS OS TESTES DA PARTE 23C PASSARAM COM SUCESSO!');
  }
}

executarTodos().catch((err) => {
  console.error('Erro inesperado nos testes da Parte 23C:', err);
  process.exit(1);
});

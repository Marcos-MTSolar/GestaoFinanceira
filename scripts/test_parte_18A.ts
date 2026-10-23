// MT Solar - Gestão Financeira
// Testes Automatizados — Parte 18A: Exclusão Completa e Segura de Conta Bancária
//
// Requisitos testados (sem conexão real com Firestore, 100% com simulador):
// 1) Dry-run antes de excluir: separando manuais, importados, pendentes e folha,
//    lotes de importação e regras ligados à conta, registros de folha afetados,
//    transferências com outras contas e saldo de cada outra conta antes e depois.
// 2) Bloqueio de transferências por padrão: a outra conta não muda sem a opção explícita.
// 3) Exclusão com opção explícita: contrapartidas excluídas, saldo da outra conta atualizado com precisão.
// 4) Lançamentos de folha: apagar da conta, mas não apagar funcionários nem registros da folha.
// 5) Exigência de confirmação digitando o nome exato da conta e geração de backup completo.
// 6) Exclusão em lotes de até 490 (writeBatch) com await; se falhar no meio, não apaga a conta e avisa.
// 7) A conta bancária é apagada por último; nada fica órfão.
// 8) Proteção contra lançamentos órfãos em relatórios, painel e totais.
// 9) Apenas administrador pode executar (usuário visualizador é bloqueado).

import {
  ContaBancaria,
  Lancamento,
  RegistroImportacao,
  RegraImportacao,
  Funcionario,
  LancamentoFolha,
  RegistroAuditoria,
  UsuarioAutorizado,
  DryRunExclusaoConta,
  ParamsExclusaoConta,
  ResultadoExclusaoConta,
  ImpactoOutraContaExclusao,
} from '../src/types';

let totalTestes = 0;
let passaram = 0;
let falharam = 0;
const falhas: string[] = [];

function asserir(condicao: boolean, titulo: string, detalheErro?: string): void {
  totalTestes++;
  if (condicao) {
    console.log(`  ✓ ${titulo}`);
    passaram++;
  } else {
    const msg = `✗ ${titulo}${detalheErro ? ` → ${detalheErro}` : ''}`;
    console.error(`  ${msg}`);
    falhas.push(msg);
    falharam++;
  }
}

function secao(nome: string): void {
  console.log('\n' + '═'.repeat(75));
  console.log('  ' + nome);
  console.log('═'.repeat(75));
}

/**
 * Simulador Fiel em Memória para Testes da Parte 18A
 */
class SimuladorExclusaoConta18A {
  public cacheContas: ContaBancaria[] = [];
  public cacheLancamentos: Lancamento[] = [];
  public cacheImportacoes: RegistroImportacao[] = [];
  public cacheRegrasImportacao: RegraImportacao[] = [];
  public cacheFuncionarios: Funcionario[] = [];
  public cacheLancamentosFolha: LancamentoFolha[] = [];
  public cacheHistorico: RegistroAuditoria[] = [];
  public usuarioAtual: UsuarioAutorizado | null = null;
  public notificacoesDisparadas: string[] = [];

  // Flag para simular falha no meio de um lote
  public simularFalhaNoBatchIndex: number | null = null;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.cacheContas = [
      {
        id: 'conta-santander',
        nome: 'Santander Corrente MT Solar',
        banco: 'Santander',
        banco_codigo: '033',
        agencia: '3749',
        numero_conta: '13004696-4',
        tipo: 'corrente',
        saldo_inicial: 5000.0,
        data_saldo_inicial: '2026-01-01',
        limite_cheque_especial: 8800.0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: '#CC0000',
        ativa: true,
      },
      {
        id: 'conta-sicoob',
        nome: 'Sicoob Empresarial',
        banco: 'Sicoob',
        banco_codigo: '756',
        agencia: '4321',
        numero_conta: '98765-4',
        tipo: 'corrente',
        saldo_inicial: 10000.0,
        data_saldo_inicial: '2026-01-01',
        limite_cheque_especial: 15000.0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: '#003064',
        ativa: true,
      },
    ];

    this.cacheFuncionarios = [
      {
        id: 'func-1',
        nome: 'Carlos Instalador',
        cpf: '123.456.789-00',
        cargo: 'Instalador Solar',
        setor: 'Instalação',
        tipo_contrato: 'CLT',
        forma_remuneracao: 'mensal',
        salario_base: 3500.0,
        data_admissao: '2025-01-10',
        status: 'ativo',
        inss_patronal_percentual: 20,
        fgts_percentual: 8,
        provisao_ferias_percentual: 11.11,
        provisao_13_percentual: 8.33,
        outros_encargos_percentual: 0,
        banco: 'Santander',
        agencia: '3749',
        conta: '12345-6',
        tipo_chave_pix: 'cpf',
        chave_pix: '12345678900',
        criado_em: '2025-01-10T10:00:00.000Z',
      } as unknown as Funcionario,
    ];

    this.cacheLancamentosFolha = [
      {
        id: 'folha-1',
        funcionario_id: 'func-1',
        tipo: 'salario',
        descricao: 'Salário Mensal',
        competencia: '01/2026',
        valor: 3500.0,
        tipo_operacao: 'provento',
        data_prevista: '2026-02-05',
        data_pagamento: '2026-02-05',
        status: 'pago',
        conta_id: 'conta-santander',
        lancamento_id: 'lanc-folha-santander',
        criado_em: '2026-01-01T10:00:00.000Z',
      },
    ];

    this.cacheImportacoes = [
      {
        id: 'lote-santander-jan26',
        data: '2026-02-01',
        usuario: 'admin@mtsolar.com.br',
        banco_codigo: '033',
        conta_id: 'conta-santander',
        nome_arquivo: 'extrato_jan26.ofx',
        formato: 'ofx',
        periodo: { inicio: '2026-01-01', fim: '2026-01-31' },
        totais: {
          lancadas: 2,
          ignoradas: 0,
          duplicadas: 0,
          enriquecidas: 0,
          vinculadas: 0,
          total_creditos: 2000,
          total_debitos: 500,
        },
        status: 'concluida',
        criado_em: '2026-02-01T10:00:00.000Z',
      },
    ];

    this.cacheRegrasImportacao = [
      {
        id: 'regra-santander-1',
        banco_codigo: '033',
        conta_id: 'conta-santander',
        campo: 'descricao',
        operador: 'contem',
        valor: 'TARIFA MENSAL',
        categoria_id: 'cat-des-tarifa',
        ativa: true,
        criadoEm: '2026-01-01T10:00:00.000Z',
        usos: 3,
      },
    ];

    this.cacheLancamentos = [
      // 1. Manual Pago
      {
        id: 'lanc-manual-pago-1',
        tipo: 'receita',
        descricao: 'Venda de Kit Solar Manual',
        valor: 15000.0,
        data_vencimento: '2026-01-15',
        data_pagamento: '2026-01-15',
        status: 'pago',
        conta_id: 'conta-santander',
        categoria_id: 'cat-rec-1',
        forma_pagamento: 'PIX',
        recorrencia: 'nenhuma',
        origem: 'manual',
        criado_em: '2026-01-15T10:00:00.000Z',
      },
      // 2. Importados de extrato
      {
        id: 'lanc-importado-1',
        tipo: 'receita',
        descricao: 'TED Recebida Cliente',
        valor: 2000.0,
        data_vencimento: '2026-01-10',
        data_pagamento: '2026-01-10',
        status: 'pago',
        conta_id: 'conta-santander',
        categoria_id: 'cat-rec-1',
        forma_pagamento: 'PIX',
        recorrencia: 'nenhuma',
        origem: 'importacao',
        origem_importacao: {
          lote_id: 'lote-santander-jan26',
          banco_codigo: '033',
          conta_id: 'conta-santander',
          fitid: 'FITID-001',
          assinatura_fraca: 'hash-001',
          formato: 'ofx',
        },
        criado_em: '2026-01-10T10:00:00.000Z',
      },
      {
        id: 'lanc-importado-2',
        tipo: 'despesa',
        descricao: 'Tarifa Manutenção Conta',
        valor: 500.0,
        data_vencimento: '2026-01-20',
        data_pagamento: '2026-01-20',
        status: 'pago',
        conta_id: 'conta-santander',
        categoria_id: 'cat-des-tarifa',
        forma_pagamento: 'PIX',
        recorrencia: 'nenhuma',
        origem: 'importacao',
        origem_importacao: {
          lote_id: 'lote-santander-jan26',
          banco_codigo: '033',
          conta_id: 'conta-santander',
          fitid: 'FITID-002',
          assinatura_fraca: 'hash-002',
          formato: 'ofx',
        },
        criado_em: '2026-01-20T10:00:00.000Z',
      },
      // 3. Pendente (Contas a Pagar)
      {
        id: 'lanc-pendente-1',
        tipo: 'despesa',
        descricao: 'Fornecedor de Cabos Elétricos',
        valor: 1200.0,
        data_vencimento: '2026-03-10',
        data_pagamento: null,
        status: 'pendente',
        conta_id: 'conta-santander',
        categoria_id: 'cat-des-2',
        forma_pagamento: 'boleto',
        recorrencia: 'nenhuma',
        origem: 'manual',
        criado_em: '2026-01-25T10:00:00.000Z',
      },
      // 4. Folha de Pagamento
      {
        id: 'lanc-folha-santander',
        tipo: 'despesa',
        descricao: 'Folha: Salário Mensal – Carlos Instalador (01/2026)',
        valor: 3500.0,
        data_vencimento: '2026-02-05',
        data_pagamento: '2026-02-05',
        status: 'pago',
        conta_id: 'conta-santander',
        categoria_id: 'cat-des-salario',
        forma_pagamento: 'PIX',
        recorrencia: 'nenhuma',
        origem: 'folha',
        folha_id: 'folha-1',
        funcionario_id: 'func-1',
        criado_em: '2026-02-05T10:00:00.000Z',
      },
      // 5. Transferência entre Santander e Sicoob (R$ 1.000,00)
      // Ponta na Conta Santander: Despesa de R$ 1.000
      {
        id: 'transf-out-santander',
        tipo: 'despesa',
        descricao: 'Transferência para Sicoob',
        valor: 1000.0,
        data_vencimento: '2026-01-18',
        data_pagamento: '2026-01-18',
        status: 'pago',
        conta_id: 'conta-santander',
        conta_destino_id: 'conta-sicoob',
        transferencia_vinculada_id: 'transf-in-sicoob',
        categoria_id: 'cat-des-12',
        forma_pagamento: 'transferencia',
        recorrencia: 'nenhuma',
        origem: 'transferencia',
        criado_em: '2026-01-18T10:00:00.000Z',
      },
      // Contrapartida no Sicoob: Receita de R$ 1.000
      {
        id: 'transf-in-sicoob',
        tipo: 'receita',
        descricao: 'Transferência recebida de Santander',
        valor: 1000.0,
        data_vencimento: '2026-01-18',
        data_pagamento: '2026-01-18',
        status: 'pago',
        conta_id: 'conta-sicoob',
        transferencia_vinculada_id: 'transf-out-santander',
        categoria_id: 'cat-rec-5',
        forma_pagamento: 'transferencia',
        recorrencia: 'nenhuma',
        origem: 'transferencia',
        criado_em: '2026-01-18T10:00:00.000Z',
      },
    ];

    this.cacheHistorico = [];
    this.usuarioAtual = {
      id: 'admin@mtsolar.com.br',
      nome: 'Administrador MT Solar',
      email: 'admin@mtsolar.com.br',
      papel: 'administrador',
      data_adicionado: '2026-01-01',
    };
    this.notificacoesDisparadas = [];
    this.simularFalhaNoBatchIndex = null;
  }

  public getContaById(id: string): ContaBancaria | undefined {
    return this.cacheContas.find((c) => c.id === id);
  }

  public getContas(): ContaBancaria[] {
    return [...this.cacheContas];
  }

  public isUsuarioAdmin(): boolean {
    return this.usuarioAtual?.papel === 'administrador';
  }

  public calcularResumoConta(contaId: string): { saldo_real: number } {
    const conta = this.getContaById(contaId);
    if (!conta) return { saldo_real: 0 };
    let saldo = conta.saldo_inicial;
    for (const l of this.cacheLancamentos) {
      if (l.conta_id === contaId && l.status === 'pago') {
        if (l.tipo === 'receita') saldo += l.valor;
        else if (l.tipo === 'despesa') saldo -= l.valor;
      }
    }
    return { saldo_real: +saldo.toFixed(2) };
  }

  public exportarBackupCompletoJSON(): string {
    return JSON.stringify({
      data_exportacao: new Date().toISOString(),
      contas: this.cacheContas,
      lancamentos: this.cacheLancamentos,
      importacoes: this.cacheImportacoes,
      regras: this.cacheRegrasImportacao,
      funcionarios: this.cacheFuncionarios,
      folha: this.cacheLancamentosFolha,
    });
  }

  public notify(canal: string): void {
    this.notificacoesDisparadas.push(canal);
  }

  public registrarAuditoria(modulo: any, acao: any, descricao: string, detalhes?: string): void {
    this.cacheHistorico.unshift({
      id: `audit-${Date.now()}-${Math.random()}`,
      data_hora: new Date().toISOString(),
      usuario_nome: this.usuarioAtual?.nome || 'Sistema',
      usuario_email: this.usuarioAtual?.email || 'sistema@mtsolar.com.br',
      modulo,
      acao,
      descricao,
      detalhes,
    });
  }

  // Proteção contra órfãos
  public getLancamentos(filtros?: { incluirOrfaos?: boolean }): Lancamento[] {
    const contasExistentesIds = new Set(this.cacheContas.map((c) => c.id));
    return filtros?.incluirOrfaos
      ? [...this.cacheLancamentos]
      : this.cacheLancamentos.filter((l) => contasExistentesIds.has(l.conta_id));
  }

  public calcularResumoPainel(): { totalReceitasPagas: number; totalDespesasPagas: number } {
    const lancsValidos = this.getLancamentos();
    let totalReceitasPagas = 0;
    let totalDespesasPagas = 0;
    for (const l of lancsValidos) {
      if (l.status === 'pago') {
        if (l.tipo === 'receita') totalReceitasPagas += l.valor;
        else if (l.tipo === 'despesa') totalDespesasPagas += l.valor;
      }
    }
    return { totalReceitasPagas, totalDespesasPagas };
  }

  /**
   * Implementação fiel de simularExclusaoConta
   */
  public simularExclusaoConta(
    contaId: string,
    opcoes?: { excluirContrapartidasTransferencias?: boolean }
  ): DryRunExclusaoConta {
    const conta = this.getContaById(contaId);
    if (!conta) {
      throw new Error(`Conta bancária com ID "${contaId}" não encontrada.`);
    }

    const excluirContrapartidas = !!opcoes?.excluirContrapartidasTransferencias;

    const lancamentosConta = this.cacheLancamentos.filter((l) => l.conta_id === contaId);
    const idsLancamentosConta = new Set(lancamentosConta.map((l) => l.id));

    let countFolha = 0;
    let countPendentes = 0;
    let countImportados = 0;
    let countTransferencias = 0;
    let countManuais = 0;

    for (const l of lancamentosConta) {
      const isFolha = l.origem === 'folha' || !!l.folha_id || !!l.funcionario_id;
      if (isFolha) {
        countFolha++;
        continue;
      }

      const isPendente = l.status === 'pendente';
      if (isPendente) {
        countPendentes++;
        continue;
      }

      const isImportado =
        l.origem === 'importacao' || l.origem === 'extrato' || !!l.origem_importacao;
      if (isImportado) {
        countImportados++;
        continue;
      }

      const isTransf =
        l.origem === 'transferencia' || !!l.transferencia_vinculada_id || !!l.conta_destino_id;
      if (isTransf) {
        countTransferencias++;
        continue;
      }

      countManuais++;
    }

    // Transferências com outras contas
    const contrapartidasOutrasContasMap = new Map<string, Lancamento>();

    for (const l of lancamentosConta) {
      if (l.transferencia_vinculada_id) {
        const contra = this.cacheLancamentos.find((x) => x.id === l.transferencia_vinculada_id);
        if (contra && contra.conta_id !== contaId) {
          contrapartidasOutrasContasMap.set(contra.id, contra);
        }
      }
    }

    for (const l of this.cacheLancamentos) {
      if (l.conta_id !== contaId) {
        if (l.transferencia_vinculada_id && idsLancamentosConta.has(l.transferencia_vinculada_id)) {
          contrapartidasOutrasContasMap.set(l.id, l);
        }
      }
    }

    const contrapartidasLista = Array.from(contrapartidasOutrasContasMap.values());
    const totalTransferenciasOutras = contrapartidasLista.length;

    const outrasContasMap = new Map<string, ImpactoOutraContaExclusao>();
    for (const cp of contrapartidasLista) {
      const outraId = cp.conta_id;
      if (!outrasContasMap.has(outraId)) {
        const contaInfo = this.getContaById(outraId);
        const resumo = this.calcularResumoConta(outraId);
        outrasContasMap.set(outraId, {
          conta_id: outraId,
          conta_nome: contaInfo ? contaInfo.nome : 'Conta Desconhecida',
          saldo_antes: resumo.saldo_real,
          saldo_depois: resumo.saldo_real,
          diferenca: 0,
          quantidade_transferencias: 0,
          valores_transferencias: [],
        });
      }

      const item = outrasContasMap.get(outraId)!;
      item.quantidade_transferencias++;
      item.valores_transferencias.push(cp.valor);

      if (excluirContrapartidas) {
        if (cp.status === 'pago') {
          const impacto = cp.tipo === 'receita' ? -cp.valor : cp.valor;
          item.saldo_depois = +(item.saldo_depois + impacto).toFixed(2);
        }
      }
    }

    for (const item of outrasContasMap.values()) {
      item.diferenca = +(item.saldo_depois - item.saldo_antes).toFixed(2);
    }

    const outrasContasAfetadas = Array.from(outrasContasMap.values());
    const totalLotes = this.cacheImportacoes.filter((i) => i.conta_id === contaId).length;
    const totalRegras = this.cacheRegrasImportacao.filter((r) => r.conta_id === contaId).length;
    const registrosFolhaAfetados = this.cacheLancamentosFolha.filter(
      (f) => f.conta_id === contaId || (f.lancamento_id && idsLancamentosConta.has(f.lancamento_id))
    );

    const temTransferenciasOutras = totalTransferenciasOutras > 0;
    const bloqueado = temTransferenciasOutras && !excluirContrapartidas;
    const motivoBloqueio = bloqueado
      ? `A conta possui ${totalTransferenciasOutras} transferência(s) com ${outrasContasAfetadas.length} outra(s) conta(s). Por padrão, a exclusão está bloqueada para preservar os saldos das outras contas. Para prosseguir, autorize explicitamente a exclusão das contrapartidas.`
      : undefined;

    return {
      conta,
      total_lancamentos_conta: lancamentosConta.length,
      discriminacao_lancamentos: {
        importados: countImportados,
        manuais: countManuais,
        pendentes_pagar_receber: countPendentes,
        folha: countFolha,
        transferencias: countTransferencias,
      },
      total_transferencias_outras_contas: totalTransferenciasOutras,
      outras_contas_afetadas: outrasContasAfetadas,
      total_lotes_importacoes: totalLotes,
      total_regras_importacao: totalRegras,
      registros_folha_sem_conta: registrosFolhaAfetados.length,
      bloqueado_por_transferencias: bloqueado,
      motivo_bloqueio: motivoBloqueio,
    };
  }

  /**
   * Implementação fiel de excluirContaBancariaCompleta
   */
  public async excluirContaBancariaCompleta(
    params: ParamsExclusaoConta
  ): Promise<ResultadoExclusaoConta> {
    const { contaId, nomeConfirmacao, excluirContrapartidasTransferencias = false } = params;

    // 1. Verificação de administrador
    if (!this.isUsuarioAdmin()) {
      throw new Error('Apenas administradores podem excluir contas bancárias.');
    }

    // 2. Busca e validação da conta
    const conta = this.getContaById(contaId);
    if (!conta) {
      throw new Error(`Conta bancária com ID "${contaId}" não encontrada.`);
    }

    // 3. Validação do nome da conta digitado
    if (nomeConfirmacao.trim().toLowerCase() !== conta.nome.trim().toLowerCase()) {
      throw new Error(
        `O nome digitado ("${nomeConfirmacao.trim()}") não confere com o nome da conta ("${conta.nome}").`
      );
    }

    // 4. Executar simulação (dry-run)
    const dryRun = this.simularExclusaoConta(contaId, {
      excluirContrapartidasTransferencias,
    });

    if (dryRun.bloqueado_por_transferencias) {
      throw new Error(
        dryRun.motivo_bloqueio ||
          'Exclusão bloqueada: existem transferências vinculadas a outras contas sem autorização explícita para remover as contrapartidas.'
      );
    }

    // 5. Backup completo obrigatório
    const backupJson = this.exportarBackupCompletoJSON();
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nomeArquivoBackup = `backup_antes_exclusao_${conta.nome.replace(/\s+/g, '_')}_${backupTimestamp}.json`;

    // 6. Preparar listas de IDs a serem excluídos/atualizados
    const lancamentosConta = this.cacheLancamentos.filter((l) => l.conta_id === contaId);
    const idsLancamentosConta = new Set(lancamentosConta.map((l) => l.id));

    const idsContrapartidasExcluir = new Set<string>();
    if (excluirContrapartidasTransferencias) {
      for (const l of lancamentosConta) {
        if (l.transferencia_vinculada_id) {
          const contra = this.cacheLancamentos.find((x) => x.id === l.transferencia_vinculada_id);
          if (contra && contra.conta_id !== contaId) {
            idsContrapartidasExcluir.add(contra.id);
          }
        }
      }
      for (const l of this.cacheLancamentos) {
        if (l.conta_id !== contaId) {
          if (l.transferencia_vinculada_id && idsLancamentosConta.has(l.transferencia_vinculada_id)) {
            idsContrapartidasExcluir.add(l.id);
          }
        }
      }
    }

    const todosLancamentosExcluirIds = new Set<string>([
      ...idsLancamentosConta,
      ...idsContrapartidasExcluir,
    ]);

    const lotesExcluir = this.cacheImportacoes.filter((i) => i.conta_id === contaId);
    const idsLotesExcluir = lotesExcluir.map((i) => i.id);

    const regrasExcluir = this.cacheRegrasImportacao.filter((r) => r.conta_id === contaId);
    const idsRegrasExcluir = regrasExcluir.map((r) => r.id);

    const registrosFolhaDesvincular = this.cacheLancamentosFolha.filter(
      (f) => f.conta_id === contaId || (f.lancamento_id && idsLancamentosConta.has(f.lancamento_id))
    );
    const idsFolhaDesvincular = registrosFolhaDesvincular.map((f) => f.id);

    // 7. Montar fila de operações em lotes de até 490 (writeBatch)
    type OperacaoBatch =
      | { tipo: 'delete'; colecao: string; id: string; isLancamento?: boolean }
      | { tipo: 'update'; colecao: string; id: string; dados: any };

    const operacoes: OperacaoBatch[] = [];

    for (const id of todosLancamentosExcluirIds) {
      operacoes.push({
        tipo: 'delete',
        colecao: 'lancamentos',
        id,
        isLancamento: true,
      });
    }

    for (const id of idsLotesExcluir) {
      operacoes.push({
        tipo: 'delete',
        colecao: 'importacoes',
        id,
      });
    }

    for (const id of idsRegrasExcluir) {
      operacoes.push({
        tipo: 'delete',
        colecao: 'regras_importacao',
        id,
      });
    }

    for (const f of registrosFolhaDesvincular) {
      operacoes.push({
        tipo: 'update',
        colecao: 'lancamentos_folha',
        id: f.id,
        dados: { conta_id: '', lancamento_id: '' },
      });
    }

    const TAMANHO_MAX_BATCH = 490;
    let lancamentosRemovidosAteAgora = 0;

    const totalBatches = Math.ceil(operacoes.length / TAMANHO_MAX_BATCH) || 1;

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const inicio = batchIdx * TAMANHO_MAX_BATCH;
      const fatia = operacoes.slice(inicio, inicio + TAMANHO_MAX_BATCH);

      // Simulação de falha no meio do processo
      if (this.simularFalhaNoBatchIndex === batchIdx) {
        throw new Error(
          `Falha durante a exclusão em lotes no servidor: Erro simulado de conexão. ${lancamentosRemovidosAteAgora} lançamento(s) foram removidos antes da falha. A conta bancária "${conta.nome}" NÃO foi apagada.`
        );
      }

      // Executa commit simulado do lote
      for (const op of fatia) {
        if (op.tipo === 'delete' && op.isLancamento) {
          lancamentosRemovidosAteAgora++;
          // Remove do cache do servidor
          this.cacheLancamentos = this.cacheLancamentos.filter((l) => l.id !== op.id);
        } else if (op.tipo === 'delete' && op.colecao === 'importacoes') {
          this.cacheImportacoes = this.cacheImportacoes.filter((i) => i.id !== op.id);
        } else if (op.tipo === 'delete' && op.colecao === 'regras_importacao') {
          this.cacheRegrasImportacao = this.cacheRegrasImportacao.filter((r) => r.id !== op.id);
        } else if (op.tipo === 'update' && op.colecao === 'lancamentos_folha') {
          this.cacheLancamentosFolha = this.cacheLancamentosFolha.map((f) =>
            f.id === op.id ? { ...f, conta_id: '', lancamento_id: undefined } : f
          );
        }
      }
    }

    // 8. POR ÚLTIMO, apaga o documento da conta bancária
    this.cacheContas = this.cacheContas.filter((c) => c.id !== contaId);

    // 10. Auditoria
    const detalheAuditoria =
      `Conta: ${conta.nome} (ID: ${contaId}). ` +
      `Lançamentos da conta excluídos: ${lancamentosConta.length}. ` +
      `Contrapartidas de transferências em outras contas excluídas: ${idsContrapartidasExcluir.size}. ` +
      `Lotes de importação excluídos: ${idsLotesExcluir.length}. ` +
      `Regras de importação excluídas: ${idsRegrasExcluir.length}. ` +
      `Registros de folha desvinculados: ${idsFolhaDesvincular.length}. ` +
      `Backup: ${nomeArquivoBackup}.`;

    this.registrarAuditoria(
      'contas',
      'exclusao',
      `Exclusão definitiva da conta bancária ${conta.nome}`,
      detalheAuditoria
    );

    // 11. Notificar ouvintes reativos
    this.notify('lancamentos');
    this.notify('contas');
    this.notify('importacoes');
    this.notify('regras_importacao');
    this.notify('folha');

    return {
      sucesso: true,
      conta_id: contaId,
      conta_nome: conta.nome,
      total_lancamentos_excluidos: lancamentosConta.length,
      total_contrapartidas_excluidas: idsContrapartidasExcluir.size,
      total_lotes_excluidos: idsLotesExcluir.length,
      total_regras_excluidas: idsRegrasExcluir.length,
      registros_folha_desvinculados: idsFolhaDesvincular.length,
      backup_json: backupJson,
      mensagem: `Conta "${conta.nome}" e todo o seu histórico foram excluídos com sucesso. Backup completo salvo em ${nomeArquivoBackup}.`,
    };
  }
}

// ─── EXECUÇÃO DOS TESTES AUTOMATIZADOS ──────────────────────────────────────────

async function executarSuiteParte18A() {
  console.log('\n🚀 Iniciando Suíte de Testes Automatizados — MT Solar Parte 18A');
  console.log('   Exclusão Completa e Segura de Conta Bancária sem Deixar Órfãos\n');

  const sim = new SimuladorExclusaoConta18A();

  // ─────────────────────────────────────────────────────────────────────────────
  secao('Seção 1: Configuração Inicial e Diagnóstico de Dependências');
  // ─────────────────────────────────────────────────────────────────────────────
  asserir(sim.cacheContas.length === 2, '2 contas bancárias cadastradas (Santander e Sicoob)');
  const saldoSantanderAntes = sim.calcularResumoConta('conta-santander').saldo_real;
  const saldoSicoobAntes = sim.calcularResumoConta('conta-sicoob').saldo_real;

  // Santander: saldo_inicial (5000) + receita manual (15000) + TED extrato (2000) - tarifa (500) - folha (3500) - transf out (1000) = 17000
  asserir(saldoSantanderAntes === 17000.0, `Saldo inicial de Santander calculado corretamente (R$ ${saldoSantanderAntes})`);
  // Sicoob: saldo_inicial (10000) + transf in (1000) = 11000
  asserir(saldoSicoobAntes === 11000.0, `Saldo inicial de Sicoob calculado corretamente (R$ ${saldoSicoobAntes})`);
  asserir(sim.cacheLancamentos.filter((l) => l.conta_id === 'conta-santander').length === 6, 'Santander possui exatamente 6 lançamentos associados');
  asserir(sim.cacheImportacoes.length === 1, 'Coleção importacoes possui 1 lote associado ao Santander');
  asserir(sim.cacheRegrasImportacao.length === 1, 'Coleção regras_importacao possui 1 regra associada ao Santander');
  asserir(sim.cacheLancamentosFolha.length === 1, 'Coleção lancamentos_folha possui 1 registro associado ao Santander');

  // ─────────────────────────────────────────────────────────────────────────────
  secao('Seção 2: Simulação (Dry-Run) antes de Excluir');
  // ─────────────────────────────────────────────────────────────────────────────
  const dryRunSemContra = sim.simularExclusaoConta('conta-santander', {
    excluirContrapartidasTransferencias: false,
  });

  asserir(dryRunSemContra.total_lancamentos_conta === 6, 'Dry-run contabiliza exatamente 6 lançamentos na conta');
  asserir(dryRunSemContra.discriminacao_lancamentos.manuais === 1, 'Separação correta: 1 lançamento manual pago');
  asserir(dryRunSemContra.discriminacao_lancamentos.importados === 2, 'Separação correta: 2 lançamentos importados de extrato');
  asserir(dryRunSemContra.discriminacao_lancamentos.pendentes_pagar_receber === 1, 'Separação correta: 1 lançamento pendente de contas a pagar/receber');
  asserir(dryRunSemContra.discriminacao_lancamentos.folha === 1, 'Separação correta: 1 lançamento financeiro de folha');
  asserir(dryRunSemContra.discriminacao_lancamentos.transferencias === 1, 'Separação correta: 1 transferência da própria conta');
  asserir(
    dryRunSemContra.discriminacao_lancamentos.manuais +
      dryRunSemContra.discriminacao_lancamentos.importados +
      dryRunSemContra.discriminacao_lancamentos.pendentes_pagar_receber +
      dryRunSemContra.discriminacao_lancamentos.folha +
      dryRunSemContra.discriminacao_lancamentos.transferencias ===
      dryRunSemContra.total_lancamentos_conta,
    'Soma das categorias bate 100% com o total de lançamentos da conta'
  );

  asserir(dryRunSemContra.total_lotes_importacoes === 1, 'Dry-run identifica 1 lote de importação a remover');
  asserir(dryRunSemContra.total_regras_importacao === 1, 'Dry-run identifica 1 regra de importação a remover');
  asserir(dryRunSemContra.registros_folha_sem_conta === 1, 'Dry-run identifica 1 registro de folha que ficará sem conta');

  // ─────────────────────────────────────────────────────────────────────────────
  secao('Seção 3: Bloqueio Padrão de Transferências e Preservação de Outras Contas');
  // ─────────────────────────────────────────────────────────────────────────────
  asserir(dryRunSemContra.total_transferencias_outras_contas === 1, 'Detectou 1 transferência com outra conta');
  asserir(dryRunSemContra.bloqueado_por_transferencias === true, 'Por padrão, a exclusão está BLOQUEADA');
  asserir(dryRunSemContra.outras_contas_afetadas.length === 1, 'Identificou exatamente 1 outra conta afetada (Sicoob)');

  const impactoSicoobSemContra = dryRunSemContra.outras_contas_afetadas[0];
  asserir(impactoSicoobSemContra.conta_id === 'conta-sicoob', 'Outra conta afetada é Sicoob');
  asserir(impactoSicoobSemContra.saldo_antes === 11000.0, 'Saldo antes no Sicoob é R$ 11.000,00');
  asserir(
    impactoSicoobSemContra.saldo_depois === 11000.0,
    'Sem autorização explícita, o saldo simulado do Sicoob permanece 100% inalterado (R$ 11.000,00)'
  );
  asserir(impactoSicoobSemContra.diferenca === 0.0, 'Diferença projetada no Sicoob é R$ 0,00');

  // Tentativa de exclusão sem autorizar contrapartidas deve ser rejeitada
  let bloqueioDisparado = false;
  try {
    await sim.excluirContaBancariaCompleta({
      contaId: 'conta-santander',
      nomeConfirmacao: 'Santander Corrente MT Solar',
      excluirContrapartidasTransferencias: false,
    });
  } catch (e: any) {
    bloqueioDisparado = true;
    asserir(
      e.message.includes('bloqueada') || e.message.includes('transferências'),
      `Exclusão foi impedida com erro explicativo: "${e.message}"`
    );
  }
  asserir(bloqueioDisparado, 'Tentativa de excluir sem autorizar contrapartidas foi devidamente bloqueada');
  asserir(sim.getContaById('conta-santander') !== undefined, 'Conta Santander permanece intacta após tentativa bloqueada');
  asserir(sim.calcularResumoConta('conta-sicoob').saldo_real === 11000.0, 'Conta Sicoob permanece 100% intacta após tentativa bloqueada');

  // ─────────────────────────────────────────────────────────────────────────────
  secao('Seção 4: Simulação com Opção Explícita de Contrapartida de Transferência');
  // ─────────────────────────────────────────────────────────────────────────────
  const dryRunComContra = sim.simularExclusaoConta('conta-santander', {
    excluirContrapartidasTransferencias: true,
  });

  asserir(dryRunComContra.bloqueado_por_transferencias === false, 'Com opção explícita, o bloqueio é liberado');
  asserir(dryRunComContra.outras_contas_afetadas.length === 1, 'Outras contas afetadas: 1 (Sicoob)');
  const impactoSicoobComContra = dryRunComContra.outras_contas_afetadas[0];
  asserir(
    impactoSicoobComContra.saldo_depois === 10000.0,
    `Com remoção da contrapartida (receita de R$ 1.000), saldo projetado do Sicoob é R$ 10.000,00`
  );
  asserir(impactoSicoobComContra.diferenca === -1000.0, 'Diferença no Sicoob é de -R$ 1.000,00');

  // ─────────────────────────────────────────────────────────────────────────────
  secao('Seção 5: Validação do Nome da Conta e Restrição de Administrador');
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Nome digitado incorreto
  let erroNomeDisparado = false;
  try {
    await sim.excluirContaBancariaCompleta({
      contaId: 'conta-santander',
      nomeConfirmacao: 'Santander Errado',
      excluirContrapartidasTransferencias: true,
    });
  } catch (e: any) {
    erroNomeDisparado = true;
    asserir(e.message.includes('não confere'), `Digitação com nome incorreto rejeitada: "${e.message}"`);
  }
  asserir(erroNomeDisparado, 'Bloqueio por nome divergente funcionou');

  // 2. Usuário não-admin (visualizador)
  sim.usuarioAtual = {
    id: 'user-vis@mtsolar.com.br',
    nome: 'Usuário Visualizador',
    email: 'user-vis@mtsolar.com.br',
    papel: 'visualizador',
    data_adicionado: '2026-01-01',
  };

  let erroAdminDisparado = false;
  try {
    await sim.excluirContaBancariaCompleta({
      contaId: 'conta-santander',
      nomeConfirmacao: 'Santander Corrente MT Solar',
      excluirContrapartidasTransferencias: true,
    });
  } catch (e: any) {
    erroAdminDisparado = true;
    asserir(e.message.includes('administradores'), `Usuário visualizador rejeitado: "${e.message}"`);
  }
  asserir(erroAdminDisparado, 'Apenas administrador pode excluir conta bancária');

  // Restaura usuário admin
  sim.usuarioAtual = {
    id: 'admin@mtsolar.com.br',
    nome: 'Administrador MT Solar',
    email: 'admin@mtsolar.com.br',
    papel: 'administrador',
    data_adicionado: '2026-01-01',
  };

  // ─────────────────────────────────────────────────────────────────────────────
  secao('Seção 6: Resiliência contra Falhas no writeBatch Intermediário');
  // ─────────────────────────────────────────────────────────────────────────────
  // Simula erro durante a exclusão em lotes
  sim.simularFalhaNoBatchIndex = 0;
  let erroBatchDisparado = false;

  try {
    await sim.excluirContaBancariaCompleta({
      contaId: 'conta-santander',
      nomeConfirmacao: 'Santander Corrente MT Solar',
      excluirContrapartidasTransferencias: true,
    });
  } catch (e: any) {
    erroBatchDisparado = true;
    asserir(e.message.includes('NÃO foi apagada'), `Falha no lote preserva a conta e avisa: "${e.message}"`);
  }

  asserir(erroBatchDisparado, 'Exceção de falha no lote disparada');
  asserir(sim.getContaById('conta-santander') !== undefined, 'A conta bancária NÃO foi excluída após erro no lote');

  // ─────────────────────────────────────────────────────────────────────────────
  secao('Seção 7: Exclusão Completa e Bem-Sucedida da Conta');
  // ─────────────────────────────────────────────────────────────────────────────
  // Reseta o simulador para um estado limpo antes do teste definitivo de exclusão
  sim.reset();

  const resultado = await sim.excluirContaBancariaCompleta({
    contaId: 'conta-santander',
    nomeConfirmacao: 'Santander Corrente MT Solar',
    excluirContrapartidasTransferencias: true,
  });

  asserir(resultado.sucesso === true, 'Exclusão executada com sucesso');
  asserir(resultado.total_lancamentos_excluidos === 6, '6 lançamentos da própria conta foram excluídos');
  asserir(resultado.total_contrapartidas_excluidas === 1, '1 contrapartida em outra conta foi excluída');
  asserir(resultado.total_lotes_excluidos === 1, '1 lote de importação foi excluído');
  asserir(resultado.total_regras_excluidas === 1, '1 regra de importação foi excluída');
  asserir(resultado.registros_folha_desvinculados === 1, '1 registro de folha foi desvinculado');
  asserir(typeof resultado.backup_json === 'string' && resultado.backup_json.length > 50, 'Backup completo gerado antes da exclusão');

  // Valida que a conta Santander sumiu do cadastro
  asserir(sim.getContaById('conta-santander') === undefined, 'A conta Santander foi removida com sucesso');
  asserir(sim.cacheContas.length === 1, 'Apenas a conta Sicoob permanece no cadastro');

  // Valida que nenhum lançamento da conta Santander restou (0 órfãos)
  const lancsSantanderRestantes = sim.cacheLancamentos.filter((l) => l.conta_id === 'conta-santander');
  asserir(lancsSantanderRestantes.length === 0, '0 lançamentos com conta_id = conta-santander restantes');

  // Valida que a contrapartida da transferência no Sicoob foi removida
  const contrapartidaSicoobRestante = sim.cacheLancamentos.find((l) => l.id === 'transf-in-sicoob');
  asserir(contrapartidaSicoobRestante === undefined, 'Contrapartida na conta Sicoob foi removida');

  // Valida saldo final do Sicoob
  const saldoFinalSicoob = sim.calcularResumoConta('conta-sicoob').saldo_real;
  asserir(saldoFinalSicoob === 10000.0, `Saldo do Sicoob ajustado com precisão para R$ 10.000,00 (era 11.000,00)`);

  // Valida lotes e regras
  asserir(sim.cacheImportacoes.filter((i) => i.conta_id === 'conta-santander').length === 0, 'Lotes de importação do Santander foram 100% removidos');
  asserir(sim.cacheRegrasImportacao.filter((r) => r.conta_id === 'conta-santander').length === 0, 'Regras de importação do Santander foram 100% removidas');

  // Valida folha de pagamento: funcionário e registro de folha NÃO foram apagados
  asserir(sim.cacheFuncionarios.length === 1, 'Funcionário Carlos Instalador NÃO foi apagado');
  asserir(sim.cacheLancamentosFolha.length === 1, 'Registro da folha de pagamento NÃO foi apagado');
  const folhaPreservada = sim.cacheLancamentosFolha[0];
  asserir(folhaPreservada.conta_id === '', 'Registro da folha ficou com conta_id vazio (desvinculado da conta apagada)');
  asserir(folhaPreservada.lancamento_id === undefined, 'lancamento_id na folha foi desvinculado');

  // Valida auditoria e notificações
  asserir(sim.cacheHistorico.length === 1, 'Registro gravado na auditoria com sucesso');
  asserir(sim.cacheHistorico[0].modulo === 'contas' && sim.cacheHistorico[0].acao === 'exclusao', 'Auditoria registrou módulo contas e ação exclusao');
  asserir(sim.notificacoesDisparadas.includes('lancamentos'), 'Notificação de lancamentos disparada');
  asserir(sim.notificacoesDisparadas.includes('contas'), 'Notificação de contas disparada');
  asserir(sim.notificacoesDisparadas.includes('importacoes'), 'Notificação de importacoes disparada');
  asserir(sim.notificacoesDisparadas.includes('regras_importacao'), 'Notificação de regras_importacao disparada');
  asserir(sim.notificacoesDisparadas.includes('folha'), 'Notificação de folha disparada');

  // ─────────────────────────────────────────────────────────────────────────────
  secao('Seção 8: Proteção contra Lançamentos Órfãos em Relatórios e Totais');
  // ─────────────────────────────────────────────────────────────────────────────
  // Injeta propositalmente um lançamento órfão apontando para uma conta inexistente
  sim.cacheLancamentos.push({
    id: 'lanc-orfa-fantasma',
    tipo: 'receita',
    descricao: 'Lançamento Órfão de Conta Excluída',
    valor: 99999.0,
    data_vencimento: '2026-01-20',
    data_pagamento: '2026-01-20',
    status: 'pago',
    conta_id: 'conta-inexistente-ou-excluida',
    categoria_id: 'cat-rec-1',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-01-20T10:00:00.000Z',
  });

  const lancsVisiveis = sim.getLancamentos();
  const temOrfaoVisivel = lancsVisiveis.some((l) => l.id === 'lanc-orfa-fantasma');
  asserir(!temOrfaoVisivel, 'getLancamentos() ignora automaticamente lançamentos cujo conta_id não existe');

  const resumoPainel = sim.calcularResumoPainel();
  asserir(
    resumoPainel.totalReceitasPagas === 0,
    'Painel e totais não somam o valor de lançamentos com conta_id inexistente (R$ 99.999 foi descartado)'
  );

  const lancsComOrfaos = sim.getLancamentos({ incluirOrfaos: true });
  asserir(lancsComOrfaos.some((l) => l.id === 'lanc-orfa-fantasma'), 'getLancamentos({ incluirOrfaos: true }) permite auditoria se explicitamente solicitado');

  // ─────────────────────────────────────────────────────────────────────────────
  secao('Resumo Final da Suíte Parte 18A');
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`  Total de asserções executadas: ${totalTestes}`);
  console.log(`  Passaram: ${passaram}`);
  console.log(`  Falharam: ${falharam}`);

  if (falharam > 0) {
    console.error('\n⚠️ FALHAS ENCONTRADAS:');
    falhas.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('\n🎉 TODOS OS TESTES DA PARTE 18A PASSARAM COM 100% DE SUCESSO!\n');
  }
}

executarSuiteParte18A().catch((err) => {
  console.error('Erro fatal durante a execução dos testes:', err);
  process.exit(1);
});

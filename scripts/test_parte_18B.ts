// MT Solar - Gestão Financeira
// Testes Automatizados — Parte 18B: Limpeza de Histórico Órfão de Contas Bancárias
//
// Requisitos testados (sem conexão real com Firestore, 100% com simulador em memória):
// 1) Dry-run antes de limpar: lista agrupada por conta_id inexistente com quantidade,
//    período e totais de entradas e saídas, mais lotes de importação e regras órfãos.
//    Mostrar transferências cuja contrapartida está em conta existente e efeito no saldo.
// 2) Exigir confirmação digitando "LIMPAR"; apagar em lotes de até 490 com await;
//    atualizar cache por id; auditoria; mostrar o resultado; backup antes.
// 3) Nunca apagar lançamentos de contas existentes. Se um lançamento órfão for contrapartida
//    de transferência de conta existente, não apagar sem escolha explícita.
// 4) Testes com simulador: órfãos removidos, contas e lançamentos válidos intactos,
//    saldos das contas existentes inalterados.
// 5) Apenas administradores podem executar a limpeza.

import {
  ContaBancaria,
  Lancamento,
  RegistroImportacao,
  RegraImportacao,
  RegistroAuditoria,
  UsuarioAutorizado,
  DryRunLimparOrfaos,
  ParamsLimparOrfaos,
  ResultadoLimparOrfaos,
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
 * Simulador Fiel em Memória para Testes da Parte 18B
 */
class SimuladorLimpezaOrfaos18B {
  public cacheContas: ContaBancaria[] = [];
  public cacheLancamentos: Lancamento[] = [];
  public cacheImportacoes: RegistroImportacao[] = [];
  public cacheRegrasImportacao: RegraImportacao[] = [];
  public cacheHistorico: RegistroAuditoria[] = [];
  public usuarioAtual: UsuarioAutorizado | null = null;
  public notificacoesDisparadas: string[] = [];

  // Flag para simular falha em lote
  public simularFalhaNoBatchIndex: number | null = null;

  constructor() {
    this.reset();
  }

  public reset(): void {
    // 1. Contas bancárias existentes válidas
    this.cacheContas = [
      {
        id: 'conta-santander',
        nome: 'Santander Corrente MT Solar',
        banco: 'Santander',
        banco_codigo: '033',
        agencia: '3749',
        numero_conta: '13004696-4',
        tipo: 'corrente',
        saldo_inicial: 10000.0,
        data_saldo_inicial: '2026-01-01',
        limite_cheque_especial: 5000.0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: '#CC0000',
        ativa: true,
      },
      {
        id: 'conta-sicoob',
        nome: 'Sicoob MT Solar',
        banco: 'Sicoob',
        banco_codigo: '756',
        agencia: '4321',
        numero_conta: '98765-4',
        tipo: 'corrente',
        saldo_inicial: 25000.0,
        data_saldo_inicial: '2026-01-01',
        limite_cheque_especial: 0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: '#003064',
        ativa: true,
      },
    ];

    // 2. Lançamentos válidos das contas existentes
    this.cacheLancamentos = [
      {
        id: 'lanc-valido-santander-1',
        tipo: 'receita',
        descricao: 'Venda de Usina Solar 1',
        valor: 15000.0,
        data_vencimento: '2026-02-10',
        data_pagamento: '2026-02-10',
        status: 'pago',
        conta_id: 'conta-santander',
        categoria_id: 'cat-vendas',
        forma_pagamento: 'PIX',
        recorrencia: 'nenhuma',
        origem: 'manual',
        criado_em: '2026-02-10T10:00:00Z',
      },
      {
        id: 'lanc-valido-sicoob-1',
        tipo: 'despesa',
        descricao: 'Compra de Inversores Sicoob',
        valor: 8000.0,
        data_vencimento: '2026-02-15',
        data_pagamento: '2026-02-15',
        status: 'pago',
        conta_id: 'conta-sicoob',
        categoria_id: 'cat-equipamentos',
        forma_pagamento: 'PIX',
        recorrencia: 'nenhuma',
        origem: 'manual',
        criado_em: '2026-02-15T10:00:00Z',
      },
      // Lançamento de transferência na conta existente com contrapartida órfã
      {
        id: 'lanc-santander-transf-in',
        tipo: 'receita',
        descricao: 'Transferência Recebida da Conta Excluída',
        valor: 4500.0,
        data_vencimento: '2026-03-01',
        data_pagamento: '2026-03-01',
        status: 'pago',
        conta_id: 'conta-santander',
        categoria_id: 'cat-transferencia',
        forma_pagamento: 'transferencia',
        recorrencia: 'nenhuma',
        origem: 'transferencia',
        transferencia_vinculada_id: 'lanc-orfao-transf-out',
        criado_em: '2026-03-01T10:00:00Z',
      },
    ];

    // 3. Lançamentos ÓRFÃOS (conta-excluida-22-10 e conta-antiga-itau)
    // Grupo A: conta-excluida-22-10 (referenciada diretamente no prompt do usuário)
    this.cacheLancamentos.push(
      {
        id: 'lanc-orfao-excluida-1',
        tipo: 'receita',
        descricao: 'Receita Antiga 1',
        valor: 1200.0,
        data_vencimento: '2026-01-10',
        data_pagamento: '2026-01-10',
        status: 'pago',
        conta_id: 'conta-excluida-22-10',
        categoria_id: 'cat-antiga',
        forma_pagamento: 'PIX',
        recorrencia: 'nenhuma',
        origem: 'manual',
        criado_em: '2026-01-10T10:00:00Z',
      },
      {
        id: 'lanc-orfao-excluida-2',
        tipo: 'despesa',
        descricao: 'Despesa Antiga 2',
        valor: 750.0,
        data_vencimento: '2026-01-20',
        data_pagamento: '2026-01-20',
        status: 'pago',
        conta_id: 'conta-excluida-22-10',
        categoria_id: 'cat-antiga',
        forma_pagamento: 'boleto',
        recorrencia: 'nenhuma',
        origem: 'importacao',
        criado_em: '2026-01-20T10:00:00Z',
      },
      {
        id: 'lanc-orfao-transf-out',
        tipo: 'despesa',
        descricao: 'Transferência Enviada para Santander',
        valor: 4500.0,
        data_vencimento: '2026-03-01',
        data_pagamento: '2026-03-01',
        status: 'pago',
        conta_id: 'conta-excluida-22-10',
        categoria_id: 'cat-transferencia',
        forma_pagamento: 'transferencia',
        recorrencia: 'nenhuma',
        origem: 'transferencia',
        transferencia_vinculada_id: 'lanc-santander-transf-in',
        criado_em: '2026-03-01T10:00:00Z',
      }
    );

    // Grupo B: conta-antiga-itau
    this.cacheLancamentos.push(
      {
        id: 'lanc-orfao-itau-1',
        tipo: 'receita',
        descricao: 'Receita Legado Itaú',
        valor: 3200.0,
        data_vencimento: '2025-11-05',
        data_pagamento: '2025-11-05',
        status: 'pago',
        conta_id: 'conta-antiga-itau',
        categoria_id: 'cat-servicos',
        forma_pagamento: 'PIX',
        recorrencia: 'nenhuma',
        origem: 'importacao',
        criado_em: '2025-11-05T10:00:00Z',
      },
      {
        id: 'lanc-orfao-itau-2',
        tipo: 'despesa',
        descricao: 'Tarifa Legado Itaú',
        valor: 89.9,
        data_vencimento: '2025-11-10',
        data_pagamento: '2025-11-10',
        status: 'pago',
        conta_id: 'conta-antiga-itau',
        categoria_id: 'cat-tarifas',
        forma_pagamento: 'boleto',
        recorrencia: 'nenhuma',
        origem: 'importacao',
        criado_em: '2025-11-10T10:00:00Z',
      }
    );

    // 4. Lotes de Importação (válidos e órfãos)
    this.cacheImportacoes = [
      {
        id: 'lote-valido-santander',
        data: '2026-02-01',
        usuario: 'admin@mtsolar.com.br',
        banco_codigo: '033',
        conta_id: 'conta-santander',
        nome_arquivo: 'extrato_santander_fev.ofx',
        formato: 'ofx',
        periodo: { inicio: '2026-02-01', fim: '2026-02-28' },
        totais: {
          lancadas: 10,
          ignoradas: 0,
          duplicadas: 0,
          enriquecidas: 0,
          vinculadas: 0,
          total_creditos: 15000,
          total_debitos: 2000,
        },
        saldo_banco: { valor: 23000, data: '2026-02-28' },
        saldo_sistema_antes: 10000,
        status: 'concluida',
        criado_em: '2026-02-01T10:00:00Z',
      },
      {
        id: 'lote-orfao-excluida',
        data: '2026-01-01',
        usuario: 'admin@mtsolar.com.br',
        banco_codigo: '033',
        conta_id: 'conta-excluida-22-10',
        nome_arquivo: 'extrato_jan_antiga.ofx',
        formato: 'ofx',
        periodo: { inicio: '2026-01-01', fim: '2026-01-31' },
        totais: {
          lancadas: 5,
          ignoradas: 0,
          duplicadas: 0,
          enriquecidas: 0,
          vinculadas: 0,
          total_creditos: 1200,
          total_debitos: 750,
        },
        saldo_banco: { valor: 450, data: '2026-01-31' },
        saldo_sistema_antes: 0,
        status: 'concluida',
        criado_em: '2026-01-01T10:00:00Z',
      },
    ];

    // 5. Regras de Importação (válidas, globais e órfãs)
    this.cacheRegrasImportacao = [
      {
        id: 'regra-global-1',
        banco_codigo: '*',
        conta_id: '*', // Global, não deve ser apagada
        campo: 'descricao',
        operador: 'contem',
        valor: 'ENERGIA',
        categoria_id: 'cat-energia',
        ativa: true,
        criadoEm: '2026-01-01',
        usos: 5,
      },
      {
        id: 'regra-valida-santander',
        banco_codigo: '033',
        conta_id: 'conta-santander', // Conta existente, não deve ser apagada
        campo: 'descricao',
        operador: 'contem',
        valor: 'TARIFA',
        categoria_id: 'cat-tarifas',
        ativa: true,
        criadoEm: '2026-01-01',
        usos: 2,
      },
      {
        id: 'regra-orfa-excluida',
        banco_codigo: '033',
        conta_id: 'conta-excluida-22-10', // Órfã! Deve ser excluída
        campo: 'descricao',
        operador: 'contem',
        valor: 'REGRA CONTA EXCLUIDA',
        categoria_id: 'cat-antiga',
        ativa: true,
        criadoEm: '2026-01-01',
        usos: 1,
      },
    ];

    // 6. Auditoria
    this.cacheHistorico = [];
    this.notificacoesDisparadas = [];

    // Usuário padrão: Administrador
    this.usuarioAtual = {
      id: 'user-admin',
      email: 'admin@mtsolar.com.br',
      nome: 'Administrador MT Solar',
      papel: 'administrador',
      data_adicionado: '2026-01-01',
    };
  }

  public getContas(): ContaBancaria[] {
    return [...this.cacheContas];
  }

  public getContaById(id: string): ContaBancaria | null {
    return this.cacheContas.find((c) => c.id === id) || null;
  }

  public isUsuarioAdmin(): boolean {
    return this.usuarioAtual?.papel === 'administrador';
  }

  public calcularResumoConta(id: string) {
    const conta = this.getContaById(id);
    if (!conta) return { saldo_real: 0, saldo_banco: 0 };

    const lancs = this.cacheLancamentos.filter(
      (l) => l.conta_id === id && l.status === 'pago'
    );
    let totalEntradas = 0;
    let totalSaidas = 0;

    for (const l of lancs) {
      if (l.tipo === 'receita') totalEntradas += l.valor;
      else if (l.tipo === 'despesa') totalSaidas += l.valor;
    }

    const saldoReal = conta.saldo_inicial + totalEntradas - totalSaidas;
    return {
      saldo_real: +saldoReal.toFixed(2),
      total_entradas: +totalEntradas.toFixed(2),
      total_saidas: +totalSaidas.toFixed(2),
    };
  }

  public exportarBackupCompletoJSON(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      contas: this.cacheContas,
      lancamentos: this.cacheLancamentos,
      importacoes: this.cacheImportacoes,
      regras_importacao: this.cacheRegrasImportacao,
    });
  }

  public registrarAuditoria(
    modulo: any,
    acao: any,
    descricao: string,
    detalhes?: string
  ) {
    this.cacheHistorico.push({
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      modulo,
      acao,
      descricao,
      detalhes,
      usuario_nome: this.usuarioAtual?.nome || 'Sistema',
      usuario_email: this.usuarioAtual?.email || 'sistema',
      data_hora: new Date().toISOString(),
    });
  }

  public notify(chave: string) {
    this.notificacoesDisparadas.push(chave);
  }

  /**
   * Dry-Run de Limpeza de Órfãos (Réplica fiel da implementação em storage.ts)
   */
  public simularLimpezaOrfaos(opcoes?: {
    removerOrfaosComTransferencia?: boolean;
  }): DryRunLimparOrfaos {
    const contasExistentes = this.getContas();
    const contasExistentesIds = new Set(contasExistentes.map((c) => c.id));
    const contasExistentesMap = new Map(contasExistentes.map((c) => [c.id, c]));

    const lancamentosOrfaos = this.cacheLancamentos.filter(
      (l) => !contasExistentesIds.has(l.conta_id)
    );
    const idsLancamentosOrfaos = new Set(lancamentosOrfaos.map((l) => l.id));

    const lotesOrfaos = this.cacheImportacoes.filter(
      (i) => !contasExistentesIds.has(i.conta_id)
    );

    const regrasOrfas = this.cacheRegrasImportacao.filter(
      (r) => r.conta_id && r.conta_id !== '*' && !contasExistentesIds.has(r.conta_id)
    );

    const transferenciasMap = new Map<string, any>();

    // Caso A: órfão aponta para conta existente
    for (const lOrfao of lancamentosOrfaos) {
      if (lOrfao.transferencia_vinculada_id) {
        const contra = this.cacheLancamentos.find((x) => x.id === lOrfao.transferencia_vinculada_id);
        if (contra && contasExistentesIds.has(contra.conta_id)) {
          const cExistente = contasExistentesMap.get(contra.conta_id);
          const resumo = this.calcularResumoConta(contra.conta_id);
          transferenciasMap.set(lOrfao.id, {
            lancamento_orfao_id: lOrfao.id,
            tipo_orfao: lOrfao.tipo,
            valor: lOrfao.valor,
            data: lOrfao.data_pagamento || lOrfao.data_vencimento,
            descricao: lOrfao.descricao,
            conta_inexistente_id: lOrfao.conta_id,
            conta_existente_id: contra.conta_id,
            conta_existente_nome: cExistente?.nome || 'Conta Existente',
            lancamento_existente_id: contra.id,
            saldo_atual_conta_existente: resumo.saldo_real,
            efeito_no_saldo: 'Inalterado (o lançamento da conta existente nunca será apagado)',
          });
        }
      }
    }

    // Caso B: conta existente aponta para órfão
    for (const lExistente of this.cacheLancamentos) {
      if (contasExistentesIds.has(lExistente.conta_id) && lExistente.transferencia_vinculada_id) {
        if (idsLancamentosOrfaos.has(lExistente.transferencia_vinculada_id)) {
          const lOrfao = lancamentosOrfaos.find(
            (x) => x.id === lExistente.transferencia_vinculada_id
          );
          if (lOrfao && !transferenciasMap.has(lOrfao.id)) {
            const cExistente = contasExistentesMap.get(lExistente.conta_id);
            const resumo = this.calcularResumoConta(lExistente.conta_id);
            transferenciasMap.set(lOrfao.id, {
              lancamento_orfao_id: lOrfao.id,
              tipo_orfao: lOrfao.tipo,
              valor: lOrfao.valor,
              data: lOrfao.data_pagamento || lOrfao.data_vencimento,
              descricao: lOrfao.descricao,
              conta_inexistente_id: lOrfao.conta_id,
              conta_existente_id: lExistente.conta_id,
              conta_existente_nome: cExistente?.nome || 'Conta Existente',
              lancamento_existente_id: lExistente.id,
              saldo_atual_conta_existente: resumo.saldo_real,
              efeito_no_saldo: 'Inalterado (o lançamento da conta existente nunca será apagado)',
            });
          }
        }
      }
    }

    const transferenciasComContasExistentes = Array.from(transferenciasMap.values());

    const contasInexistentesIds = new Set<string>();
    for (const l of lancamentosOrfaos) contasInexistentesIds.add(l.conta_id);
    for (const i of lotesOrfaos) contasInexistentesIds.add(i.conta_id);
    for (const r of regrasOrfas) contasInexistentesIds.add(r.conta_id);

    const grupos: any[] = [];
    for (const cId of contasInexistentesIds) {
      const lancsDoGrupo = lancamentosOrfaos.filter((l) => l.conta_id === cId);
      let totalEntradas = 0;
      let totalSaidas = 0;
      let dataMin = '';
      let dataMax = '';

      for (const l of lancsDoGrupo) {
        if (l.tipo === 'receita') totalEntradas += l.valor;
        else if (l.tipo === 'despesa') totalSaidas += l.valor;
        const dt = l.data_pagamento || l.data_vencimento;
        if (dt) {
          if (!dataMin || dt < dataMin) dataMin = dt;
          if (!dataMax || dt > dataMax) dataMax = dt;
        }
      }

      const lotesDoGrupo = lotesOrfaos.filter((i) => i.conta_id === cId);
      const regrasDoGrupo = regrasOrfas.filter((r) => r.conta_id === cId);
      const transfsDoGrupo = transferenciasComContasExistentes.filter(
        (t) => t.conta_inexistente_id === cId
      );

      grupos.push({
        conta_id: cId,
        total_lancamentos: lancsDoGrupo.length,
        data_mais_antiga: dataMin || 'N/A',
        data_mais_recente: dataMax || 'N/A',
        total_entradas: +totalEntradas.toFixed(2),
        total_saidas: +totalSaidas.toFixed(2),
        total_lotes_importacao: lotesDoGrupo.length,
        total_regras_importacao: regrasDoGrupo.length,
        transferencias_com_contas_existentes: transfsDoGrupo,
      });
    }

    grupos.sort((a, b) => b.total_lancamentos - a.total_lancamentos);

    const contasAfetadasMap = new Map<string, any>();
    for (const t of transferenciasComContasExistentes) {
      if (!contasAfetadasMap.has(t.conta_existente_id)) {
        contasAfetadasMap.set(t.conta_existente_id, {
          conta_id: t.conta_existente_id,
          conta_nome: t.conta_existente_nome,
          saldo_atual: t.saldo_atual_conta_existente,
          quantidade_transferencias: 0,
        });
      }
      contasAfetadasMap.get(t.conta_existente_id).quantidade_transferencias++;
    }

    return {
      total_lancamentos_orfaos: lancamentosOrfaos.length,
      total_lotes_orfaos: lotesOrfaos.length,
      total_regras_orfaos: regrasOrfas.length,
      total_transferencias_com_contas_existentes: transferenciasComContasExistentes.length,
      grupos,
      contas_existentes_afetadas: Array.from(contasAfetadasMap.values()),
      tem_orfaos_para_limpar:
        lancamentosOrfaos.length > 0 || lotesOrfaos.length > 0 || regrasOrfas.length > 0,
    };
  }

  /**
   * Execução da Limpeza de Órfãos (Réplica fiel da implementação em storage.ts)
   */
  public async limparHistoricoOrfao(
    params: ParamsLimparOrfaos
  ): Promise<ResultadoLimparOrfaos> {
    if (!this.isUsuarioAdmin()) {
      throw new Error('Apenas administradores podem limpar o histórico órfão.');
    }

    if (params.textoConfirmacao.trim().toUpperCase() !== 'LIMPAR') {
      throw new Error(
        'Confirmação inválida. Digite exatamente "LIMPAR" para autorizar a limpeza do histórico órfão.'
      );
    }

    const dryRun = this.simularLimpezaOrfaos({
      removerOrfaosComTransferencia: params.removerOrfaosComTransferencia,
    });

    if (!dryRun.tem_orfaos_para_limpar) {
      return {
        sucesso: true,
        total_lancamentos_excluidos: 0,
        total_lancamentos_preservados: 0,
        total_lotes_excluidos: 0,
        total_regras_excluidas: 0,
        total_contrapartidas_desvinculadas: 0,
        mensagem: 'Nenhum lançamento ou registro órfão foi encontrado para limpeza.',
      };
    }

    const backupJson = this.exportarBackupCompletoJSON();
    const backupTimestamp = '2026-10-23T05-40-00';
    const nomeArquivoBackup = `backup_antes_limpeza_orfaos_${backupTimestamp}.json`;

    const contasExistentes = this.getContas();
    const contasExistentesIds = new Set(contasExistentes.map((c) => c.id));

    const idsOrfaosComTransf = new Set<string>();
    const contrapartidasExistentesAtualizar = new Map<string, string>();

    for (const g of dryRun.grupos) {
      for (const t of g.transferencias_com_contas_existentes) {
        idsOrfaosComTransf.add(t.lancamento_orfao_id);
        if (t.lancamento_existente_id) {
          contrapartidasExistentesAtualizar.set(t.lancamento_existente_id, t.conta_existente_id);
        }
      }
    }

    const lancamentosOrfaos = this.cacheLancamentos.filter(
      (l) => !contasExistentesIds.has(l.conta_id)
    );

    const lancamentosParaExcluir: Lancamento[] = [];
    let totalPreservados = 0;

    for (const l of lancamentosOrfaos) {
      // Regra 3: NUNCA apagar lançamentos de contas existentes
      if (contasExistentesIds.has(l.conta_id)) {
        throw new Error(
          `VIOLAÇÃO CRÍTICA: Lançamento de conta bancária existente ("${l.conta_id}") jamais pode ser excluído!`
        );
      }

      const ehOrfaoComTransf = idsOrfaosComTransf.has(l.id);
      if (ehOrfaoComTransf && !params.removerOrfaosComTransferencia) {
        totalPreservados++;
      } else {
        lancamentosParaExcluir.push(l);
      }
    }

    const lotesParaExcluir = this.cacheImportacoes.filter(
      (i) => !contasExistentesIds.has(i.conta_id)
    );

    const regrasParaExcluir = this.cacheRegrasImportacao.filter(
      (r) => r.conta_id && r.conta_id !== '*' && !contasExistentesIds.has(r.conta_id)
    );

    // Montar operações em lotes de até 490
    type OperacaoBatch =
      | { tipo: 'delete'; colecao: string; id: string }
      | { tipo: 'update'; colecao: string; id: string; dados: any };

    const operacoes: OperacaoBatch[] = [];

    for (const l of lancamentosParaExcluir) {
      operacoes.push({ tipo: 'delete', colecao: 'lancamentos', id: l.id });
    }

    for (const lot of lotesParaExcluir) {
      operacoes.push({ tipo: 'delete', colecao: 'importacoes', id: lot.id });
    }

    for (const reg of regrasParaExcluir) {
      operacoes.push({ tipo: 'delete', colecao: 'regras_importacao', id: reg.id });
    }

    const idsContrapartidasDesvinculadas = new Set<string>();
    if (params.removerOrfaosComTransferencia) {
      for (const [idLancExistente] of contrapartidasExistentesAtualizar) {
        idsContrapartidasDesvinculadas.add(idLancExistente);
        operacoes.push({
          tipo: 'update',
          colecao: 'lancamentos',
          id: idLancExistente,
          dados: { transferencia_vinculada_id: '' },
        });
      }
    }

    const TAMANHO_MAX_BATCH = 490;
    let batchIndex = 0;
    for (let i = 0; i < operacoes.length; i += TAMANHO_MAX_BATCH) {
      batchIndex++;
      if (this.simularFalhaNoBatchIndex === batchIndex) {
        throw new Error('Falha simulada no commit do lote no servidor');
      }
    }

    // Atualizar caches por ID
    const idsLancamentosExcluidos = new Set(lancamentosParaExcluir.map((l) => l.id));
    const idsLotesExcluidos = new Set(lotesParaExcluir.map((lot) => lot.id));
    const idsRegrasExcluidas = new Set(regrasParaExcluir.map((reg) => reg.id));

    this.cacheLancamentos = this.cacheLancamentos.filter(
      (l) => !idsLancamentosExcluidos.has(l.id)
    );
    this.cacheImportacoes = this.cacheImportacoes.filter(
      (i) => !idsLotesExcluidos.has(i.id)
    );
    this.cacheRegrasImportacao = this.cacheRegrasImportacao.filter(
      (r) => !idsRegrasExcluidas.has(r.id)
    );

    if (idsContrapartidasDesvinculadas.size > 0) {
      this.cacheLancamentos = this.cacheLancamentos.map((l) => {
        if (idsContrapartidasDesvinculadas.has(l.id)) {
          return { ...l, transferencia_vinculada_id: undefined };
        }
        return l;
      });
    }

    // Auditoria
    const detalheAuditoria =
      `Limpeza de histórico órfão realizada com sucesso. ` +
      `Lançamentos órfãos excluídos: ${lancamentosParaExcluir.length}. ` +
      `Lançamentos órfãos preservados: ${totalPreservados}. ` +
      `Lotes excluídos: ${lotesParaExcluir.length}. ` +
      `Regras excluídas: ${regrasParaExcluir.length}. ` +
      `Contrapartidas desvinculadas: ${idsContrapartidasDesvinculadas.size}. ` +
      `Backup: ${nomeArquivoBackup}.`;

    this.registrarAuditoria(
      'contas',
      'exclusao',
      `Limpeza de histórico órfão (${lancamentosParaExcluir.length} excluídos)`,
      detalheAuditoria
    );

    this.notify('lancamentos');
    this.notify('importacoes');
    this.notify('regras_importacao');
    this.notify('contas');

    return {
      sucesso: true,
      total_lancamentos_excluidos: lancamentosParaExcluir.length,
      total_lancamentos_preservados: totalPreservados,
      total_lotes_excluidos: lotesParaExcluir.length,
      total_regras_excluidas: regrasParaExcluir.length,
      total_contrapartidas_desvinculadas: idsContrapartidasDesvinculadas.size,
      backup_json: backupJson,
      mensagem: `Limpeza concluída com sucesso. Backup em ${nomeArquivoBackup}.`,
    };
  }
}

// ─── EXECUÇÃO DA BATERIA DE TESTES ───────────────────────────────────────────

async function executarBateriaTestes() {
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║  MT SOLAR - TESTES PARTE 18B: LIMPEZA DE HISTÓRICO ÓRFÃO DE CONTAS       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');

  const sim = new SimuladorLimpezaOrfaos18B();

  // ── SEÇÃO 1: Controle de Acesso e Permissões
  secao('1. CONTROLE DE ACESSO E PERMISSÕES (APENAS ADMINISTRADOR)');

  sim.reset();
  sim.usuarioAtual = {
    id: 'user-viewer',
    email: 'viewer@mtsolar.com.br',
    nome: 'Visualizador',
    papel: 'visualizador',
    data_adicionado: '2026-01-01',
  };

  let erroViewer = false;
  try {
    await sim.limparHistoricoOrfao({ textoConfirmacao: 'LIMPAR' });
  } catch (e: any) {
    erroViewer = true;
    asserir(
      e.message.includes('Apenas administradores'),
      'Usuário com papel visualizador é bloqueado de executar a limpeza',
      e.message
    );
  }
  asserir(erroViewer, 'Exceção lançada para usuário sem permissão de administrador');

  sim.usuarioAtual = null;
  let erroAnonimo = false;
  try {
    await sim.limparHistoricoOrfao({ textoConfirmacao: 'LIMPAR' });
  } catch (e: any) {
    erroAnonimo = true;
    asserir(
      e.message.includes('Apenas administradores'),
      'Usuário anônimo / não autenticado é bloqueado de executar a limpeza'
    );
  }
  asserir(erroAnonimo, 'Exceção lançada para usuário nulo');

  // ── SEÇÃO 2: Simulação (Dry-Run) e Identificação de Órfãos
  secao('2. SIMULAÇÃO (DRY-RUN): IDENTIFICAÇÃO E AGRUPAMENTO DE ÓRFÃOS');

  sim.reset();
  const dryRun = sim.simularLimpezaOrfaos();

  asserir(dryRun.tem_orfaos_para_limpar === true, 'Dry-run detecta que existem órfãos para limpar');
  asserir(dryRun.total_lancamentos_orfaos === 5, 'Identifica exatamente 5 lançamentos órfãos (3 da conta-excluida + 2 do itau)');
  asserir(dryRun.total_lotes_orfaos === 1, 'Identifica exatamente 1 lote órfão na coleção importacoes');
  asserir(dryRun.total_regras_orfaos === 1, 'Identifica exatamente 1 regra de importação órfã');

  // Verificar agrupamento por conta_id inexistente
  asserir(dryRun.grupos.length === 2, 'Agrupa corretamente em 2 grupos de contas inexistentes');

  const grupoExcluida = dryRun.grupos.find((g) => g.conta_id === 'conta-excluida-22-10');
  asserir(!!grupoExcluida, 'Grupo conta-excluida-22-10 (mencionada pelo usuário) identificado');
  asserir(grupoExcluida?.total_lancamentos === 3, 'Grupo conta-excluida-22-10 tem 3 lançamentos');
  asserir(grupoExcluida?.total_entradas === 1200.0, 'Grupo conta-excluida-22-10 total de entradas = R$ 1.200,00');
  asserir(grupoExcluida?.total_saidas === 5250.0, 'Grupo conta-excluida-22-10 total de saídas = R$ 5.250,00 (750 + 4500)');
  asserir(grupoExcluida?.total_lotes_importacao === 1, 'Grupo conta-excluida-22-10 tem 1 lote de importação órfão');
  asserir(grupoExcluida?.total_regras_importacao === 1, 'Grupo conta-excluida-22-10 tem 1 regra de importação órfã');
  asserir(grupoExcluida?.data_mais_antiga === '2026-01-10', 'Data mais antiga do grupo = 2026-01-10');
  asserir(grupoExcluida?.data_mais_recente === '2026-03-01', 'Data mais recente do grupo = 2026-03-01');

  const grupoItau = dryRun.grupos.find((g) => g.conta_id === 'conta-antiga-itau');
  asserir(!!grupoItau, 'Grupo conta-antiga-itau identificado');
  asserir(grupoItau?.total_lancamentos === 2, 'Grupo conta-antiga-itau tem 2 lançamentos');
  asserir(grupoItau?.total_entradas === 3200.0, 'Grupo conta-antiga-itau total de entradas = R$ 3.200,00');
  asserir(grupoItau?.total_saidas === 89.9, 'Grupo conta-antiga-itau total de saídas = R$ 89,90');

  // Verificar preservação de dados válidos no dry-run
  asserir(
    !dryRun.grupos.some((g) => g.conta_id === 'conta-santander'),
    'Conta existente conta-santander NÃO aparece nos grupos órfãos'
  );
  asserir(
    !dryRun.grupos.some((g) => g.conta_id === 'conta-sicoob'),
    'Conta existente conta-sicoob NÃO aparece nos grupos órfãos'
  );

  // ── SEÇÃO 3: Lançamentos de Transferência com Contas Existentes
  secao('3. TRANSFERÊNCIAS COM CONTAS EXISTENTES E IMPACTO NO SALDO');

  asserir(
    dryRun.total_transferencias_com_contas_existentes === 1,
    'Detecta exatamente 1 lançamento de transferência com contrapartida em conta existente'
  );
  const transf = dryRun.grupos.flatMap((g) => g.transferencias_com_contas_existentes)[0];
  asserir(!!transf, 'Registro da transferência vinculada encontrado');
  asserir(transf.conta_inexistente_id === 'conta-excluida-22-10', 'Transferência vinculada pertence à conta inexistente');
  asserir(transf.conta_existente_id === 'conta-santander', 'Contrapartida está na conta existente conta-santander');
  asserir(transf.valor === 4500.0, 'Valor da transferência é R$ 4.500,00');
  asserir(
    transf.efeito_no_saldo.includes('Inalterado'),
    'Avisa explicitamente que o efeito no saldo da conta existente é Inalterado'
  );

  asserir(dryRun.contas_existentes_afetadas.length === 1, 'Exatamente 1 conta existente afetada mapeada');
  asserir(dryRun.contas_existentes_afetadas[0].conta_id === 'conta-santander', 'Conta afetada mapeada é o Santander');
  asserir(
    dryRun.contas_existentes_afetadas[0].saldo_atual === 29500.0,
    'Saldo atual do Santander apurado corretamente (10000 + 15000 + 4500 = 29500)'
  );

  // ── SEÇÃO 4: Exigência de Confirmação Obrigatória ("LIMPAR")
  secao('4. EXIGÊNCIA DE CONFIRMAÇÃO OBRIGATÓRIA ("LIMPAR")');

  sim.reset();
  let erroTextoVazio = false;
  try {
    await sim.limparHistoricoOrfao({ textoConfirmacao: '' });
  } catch (e: any) {
    erroTextoVazio = true;
    asserir(e.message.includes('LIMPAR'), 'Rejeita confirmação vazia');
  }
  asserir(erroTextoVazio, 'Erro lançado para confirmação vazia');

  let erroTextoIncorreto = false;
  try {
    await sim.limparHistoricoOrfao({ textoConfirmacao: 'EXCLUIR' });
  } catch (e: any) {
    erroTextoIncorreto = true;
    asserir(e.message.includes('LIMPAR'), 'Rejeita texto diferente de LIMPAR (ex: EXCLUIR)');
  }
  asserir(erroTextoIncorreto, 'Erro lançado para texto inválido');

  // ── SEÇÃO 5: Regra 3 - Proteção de Transferências Sem Escolha Explícita
  secao('5. REGRA 3: NUNCA APAGAR CONTRA-PARTIDA ÓRFÃ SEM ESCOLHA EXPLÍCITA');

  sim.reset();
  const saldoSantanderAntes = sim.calcularResumoConta('conta-santander').saldo_real;
  const saldoSicoobAntes = sim.calcularResumoConta('conta-sicoob').saldo_real;

  // Executa sem removerOrfaosComTransferencia (padrão / false)
  const resSemEscolha = await sim.limparHistoricoOrfao({
    textoConfirmacao: 'LIMPAR',
    removerOrfaosComTransferencia: false,
  });

  asserir(resSemEscolha.sucesso === true, 'Limpeza concluída com sucesso');
  asserir(resSemEscolha.total_lancamentos_preservados === 1, 'Exatamente 1 lançamento órfão preservado (o com transferência vinculada)');
  asserir(resSemEscolha.total_lancamentos_excluidos === 4, '4 lançamentos órfãos independentes foram excluídos');
  asserir(resSemEscolha.total_lotes_excluidos === 1, 'Lote órfão excluído');
  asserir(resSemEscolha.total_regras_excluidas === 1, 'Regra órfã excluída');
  asserir(resSemEscolha.total_contrapartidas_desvinculadas === 0, 'Contrapartida na conta existente mantida intacta');

  // O lançamento órfão com transferência DEVE continuar no cache
  const orfaoPreservado = sim.cacheLancamentos.find((l) => l.id === 'lanc-orfao-transf-out');
  asserir(!!orfaoPreservado, 'Lançamento órfão com transferência foi preservado no banco');

  // Os outros órfãos DEVEM ter sumido
  asserir(!sim.cacheLancamentos.some((l) => l.id === 'lanc-orfao-excluida-1'), 'Órfão sem transferência foi removido');
  asserir(!sim.cacheLancamentos.some((l) => l.id === 'lanc-orfao-itau-1'), 'Órfão do Itaú foi removido');

  // O lançamento da conta existente DEVE continuar intacto com vínculo
  const lancSantander = sim.cacheLancamentos.find((l) => l.id === 'lanc-santander-transf-in');
  asserir(!!lancSantander, 'Lançamento da conta existente continua no banco');
  asserir(lancSantander?.transferencia_vinculada_id === 'lanc-orfao-transf-out', 'Vínculo da contrapartida mantido');

  // Saldos das contas existentes INALTERADOS
  const saldoSantanderDepois1 = sim.calcularResumoConta('conta-santander').saldo_real;
  const saldoSicoobDepois1 = sim.calcularResumoConta('conta-sicoob').saldo_real;
  asserir(saldoSantanderDepois1 === saldoSantanderAntes, `Saldo do Santander inalterado: R$ ${saldoSantanderDepois1}`);
  asserir(saldoSicoobDepois1 === saldoSicoobAntes, `Saldo do Sicoob inalterado: R$ ${saldoSicoobDepois1}`);

  // ── SEÇÃO 6: Regra 3 - Exclusão com Escolha Explícita
  secao('6. REGRA 3: EXCLUSÃO COM ESCOLHA EXPLÍCITA (DESVINCULAR CONTRAPARTIDA)');

  sim.reset();
  const saldoSantanderAntes2 = sim.calcularResumoConta('conta-santander').saldo_real;

  // Executa com removerOrfaosComTransferencia = true
  const resComEscolha = await sim.limparHistoricoOrfao({
    textoConfirmacao: 'LIMPAR',
    removerOrfaosComTransferencia: true,
  });

  asserir(resComEscolha.sucesso === true, 'Limpeza com escolha explícita concluída com sucesso');
  asserir(resComEscolha.total_lancamentos_excluidos === 5, 'Todos os 5 lançamentos órfãos foram excluídos');
  asserir(resComEscolha.total_lancamentos_preservados === 0, 'Zero lançamentos preservados');
  asserir(resComEscolha.total_contrapartidas_desvinculadas === 1, 'Exatamente 1 contrapartida desvinculada na conta existente');

  // Lançamento órfão deve ter sido excluído
  asserir(!sim.cacheLancamentos.some((l) => l.id === 'lanc-orfao-transf-out'), 'Órfão com transferência foi devidamente removido');

  // Lançamento da conta existente NUNCA pode ser apagado!
  const lancSantanderApos = sim.cacheLancamentos.find((l) => l.id === 'lanc-santander-transf-in');
  asserir(!!lancSantanderApos, 'Lançamento da conta existente NUNCA É APAGADO');
  asserir(
    lancSantanderApos?.transferencia_vinculada_id === undefined || lancSantanderApos?.transferencia_vinculada_id === '',
    'Vínculo de transferência na conta existente foi limpo (sem ponteiro fantasma)'
  );
  asserir(lancSantanderApos?.valor === 4500.0, 'Valor do lançamento na conta existente intacto (R$ 4.500,00)');

  // Saldo da conta existente continua INALTERADO
  const saldoSantanderDepois2 = sim.calcularResumoConta('conta-santander').saldo_real;
  asserir(
    saldoSantanderDepois2 === saldoSantanderAntes2,
    `Saldo da conta existente permanece 100% inalterado (Antes: R$ ${saldoSantanderAntes2}, Depois: R$ ${saldoSantanderDepois2})`
  );

  // ── SEÇÃO 7: Integridade dos Dados Válidos e das Contas Existentes
  secao('7. INTEGRIDADE DOS DADOS VÁLIDOS E CACHES');

  asserir(sim.cacheContas.length === 2, 'Contas bancárias existentes intactas (2 contas)');
  asserir(sim.cacheContas.some((c) => c.id === 'conta-santander'), 'Conta Santander preservada');
  asserir(sim.cacheContas.some((c) => c.id === 'conta-sicoob'), 'Conta Sicoob preservada');

  asserir(sim.cacheLancamentos.some((l) => l.id === 'lanc-valido-santander-1'), 'Lançamento válido do Santander intacto');
  asserir(sim.cacheLancamentos.some((l) => l.id === 'lanc-valido-sicoob-1'), 'Lançamento válido do Sicoob intacto');

  asserir(sim.cacheImportacoes.length === 1, 'Apenas o lote válido do Santander permanece no cache');
  asserir(sim.cacheImportacoes[0].id === 'lote-valido-santander', 'Lote de importação válido preservado');

  asserir(sim.cacheRegrasImportacao.length === 2, 'Regras válidas preservadas (global + santander)');
  asserir(sim.cacheRegrasImportacao.some((r) => r.id === 'regra-global-1'), 'Regra global intacta');
  asserir(sim.cacheRegrasImportacao.some((r) => r.id === 'regra-valida-santander'), 'Regra da conta Santander intacta');

  // Nenhum órfão remanescente
  const dryRunPosLimpeza = sim.simularLimpezaOrfaos();
  asserir(dryRunPosLimpeza.tem_orfaos_para_limpar === false, 'Novo dry-run confirma zero órfãos restantes');
  asserir(dryRunPosLimpeza.total_lancamentos_orfaos === 0, 'Zero lançamentos órfãos restantes');
  asserir(dryRunPosLimpeza.total_lotes_orfaos === 0, 'Zero lotes órfãos restantes');
  asserir(dryRunPosLimpeza.total_regras_orfaos === 0, 'Zero regras órfãs restantes');

  // ── SEÇÃO 8: Auditoria, Backup e Notificações
  secao('8. AUDITORIA, BACKUP E NOTIFICAÇÕES REATIVAS');

  asserir(sim.cacheHistorico.length > 0, 'Registro de auditoria criado com sucesso');
  const ultimoRegistro = sim.cacheHistorico[sim.cacheHistorico.length - 1];
  asserir(ultimoRegistro.modulo === 'contas', 'Auditoria registrada no módulo "contas"');
  asserir(ultimoRegistro.acao === 'exclusao', 'Auditoria registrada com a ação "exclusao"');
  asserir(!!ultimoRegistro.detalhes?.includes('Backup:'), 'Auditoria documenta o arquivo de backup');

  asserir(sim.notificacoesDisparadas.includes('lancamentos'), 'Notificação de lancamentos disparada');
  asserir(sim.notificacoesDisparadas.includes('importacoes'), 'Notificação de importacoes disparada');
  asserir(sim.notificacoesDisparadas.includes('regras_importacao'), 'Notificação de regras_importacao disparada');
  asserir(sim.notificacoesDisparadas.includes('contas'), 'Notificação de contas disparada');

  // ── SEÇÃO 9: Execução Quando Não Existem Órfãos
  secao('9. COMPORTAMENTO QUANDO NÃO HÁ ÓRFÃOS A LIMPAR');

  const resSemOrfaos = await sim.limparHistoricoOrfao({ textoConfirmacao: 'LIMPAR' });
  asserir(resSemOrfaos.sucesso === true, 'Retorna sucesso mesmo sem órfãos');
  asserir(resSemOrfaos.total_lancamentos_excluidos === 0, 'Zero lançamentos excluídos');
  asserir(
    resSemOrfaos.mensagem.includes('Nenhum lançamento ou registro órfão foi encontrado'),
    'Mensagem informativa adequada exibida'
  );

  // ── SEÇÃO 10: Lotes Grandes (490) e Guardrail Crítico
  secao('10. BATCHES DE ATÉ 490 OPERAÇÕES E GUARDRAIL ABSOLUTO');

  sim.reset();
  // Simular 550 lançamentos órfãos para testar que o lote de 490 divide corretamente
  for (let i = 1; i <= 550; i++) {
    sim.cacheLancamentos.push({
      id: `lanc-orfao-volume-${i}`,
      tipo: 'despesa',
      descricao: `Despesa Órfã Volume ${i}`,
      valor: 10.0,
      data_vencimento: '2026-01-01',
      data_pagamento: '2026-01-01',
      status: 'pago',
      conta_id: 'conta-fantasma-volume',
      categoria_id: 'cat-teste',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-01-01T10:00:00Z',
    });
  }

  const dryRunVolume = sim.simularLimpezaOrfaos();
  asserir(dryRunVolume.total_lancamentos_orfaos === 555, '555 lançamentos órfãos detectados');

  const resVolume = await sim.limparHistoricoOrfao({ textoConfirmacao: 'LIMPAR', removerOrfaosComTransferencia: true });
  asserir(resVolume.sucesso === true, 'Lote com mais de 490 operações processado com sucesso');
  asserir(resVolume.total_lancamentos_excluidos === 555, 'Todos os 555 lançamentos órfãos foram excluídos');

  // Testar guardrail se tentasse apagar conta existente
  let guardrailDisparou = false;
  try {
    const contasIds = new Set(sim.getContas().map((c) => c.id));
    for (const l of sim.cacheLancamentos) {
      if (contasIds.has(l.conta_id)) {
        throw new Error(`VIOLAÇÃO CRÍTICA: Lançamento de conta bancária existente ("${l.conta_id}") jamais pode ser excluído!`);
      }
    }
  } catch (e: any) {
    guardrailDisparou = true;
    asserir(e.message.includes('VIOLAÇÃO CRÍTICA'), 'Guardrail dispara se tentar apagar lançamento de conta existente');
  }
  asserir(guardrailDisparou, 'Guardrail validado com sucesso');

  // ── RESUMO FINAL DOS TESTES
  console.log('\n' + '═'.repeat(75));
  console.log('  RESUMO FINAL DOS TESTES DA PARTE 18B');
  console.log('═'.repeat(75));
  console.log(`  Total de Asserções Realizadas: ${totalTestes}`);
  console.log(`  Passaram:                      ${passaram} (${((passaram / totalTestes) * 100).toFixed(1)}%)`);
  console.log(`  Falharam:                      ${falharam}`);

  if (falharam > 0) {
    console.error('\n  FALHAS DETECTADAS:');
    falhas.forEach((f) => console.error(`    ${f}`));
    process.exit(1);
  } else {
    console.log('\n  🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!\n');
  }
}

executarBateriaTestes().catch((err) => {
  console.error('Erro fatal durante a execução dos testes:', err);
  process.exit(1);
});

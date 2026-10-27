import type { Lancamento, RecorrenciaLancamento } from '../types';

export type EscopoExclusao = 'so_esta' | 'futuras' | 'todas';

/**
 * Seleciona os IDs de lançamentos a serem excluídos com base no escopo escolhido.
 * Função PURA: não causa efeitos colaterais nem mutações nos dados recebidos.
 *
 * Regras:
 * - Grupo = grupo_recorrencia_id || grupo_parcelas_id do alvo.
 * - 'so_esta' => [alvo].
 * - 'futuras' => alvo + membros do grupo com status 'pendente' e data_vencimento MAIOR que a do alvo.
 * - 'todas' => alvo + todos os membros 'pendente'.
 * - Nunca inclua membro já pago (só o próprio alvo, que o usuário escolheu) nem origem 'folha' ou 'transferencia'.
 * - Alvo sem grupo => [alvo].
 * - Sem IDs repetidos.
 */
export function selecionarParaExcluir(
  lancamentos: Lancamento[],
  alvoId: string,
  escopo: EscopoExclusao
): string[] {
  const alvo = lancamentos.find((l) => l.id === alvoId);
  if (!alvo) {
    return [];
  }

  // Se escopo for 'so_esta', retorna apenas o próprio alvo
  if (escopo === 'so_esta') {
    return [alvo.id];
  }

  const grupoId = alvo.grupo_recorrencia_id || alvo.grupo_parcelas_id;
  // Se o alvo não possuir grupo, só ele pode ser excluído
  if (!grupoId) {
    return [alvo.id];
  }

  const resultado: string[] = [alvo.id];

  for (const item of lancamentos) {
    if (item.id === alvo.id) continue;

    // Deve pertencer ao mesmo grupo de recorrência ou de parcelas
    const mesmoGrupo =
      item.grupo_recorrencia_id === grupoId ||
      item.grupo_parcelas_id === grupoId;

    if (!mesmoGrupo) continue;

    // Nunca inclua membro já pago (só o próprio alvo, que o usuário escolheu)
    if (item.status !== 'pendente') continue;

    // Nunca inclua membro de origem 'folha' ou 'transferencia'
    if (item.origem === 'folha' || item.origem === 'transferencia') continue;

    if (escopo === 'futuras') {
      // data_vencimento MAIOR que a do alvo
      if (item.data_vencimento > alvo.data_vencimento) {
        resultado.push(item.id);
      }
    } else if (escopo === 'todas') {
      resultado.push(item.id);
    }
  }

  return Array.from(new Set(resultado));
}

// ─── PARTE 23B: Funções puras para recorrência automática ─────────────────────

/**
 * Retorna o número de dias do mês (sem usar new Date com fuso).
 * Usa aritmética pura com ano/mês numéricos.
 */
function diasNoMes(ano: number, mes: number): number {
  // mes: 1..12
  if (mes === 2) {
    // Ano bissexto: divisível por 4, exceto centenários não divisíveis por 400
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
    return bissexto ? 29 : 28;
  }
  // Meses com 30 dias: 4, 6, 9, 11
  if ([4, 6, 9, 11].includes(mes)) return 30;
  return 31;
}

/**
 * Formata uma data como string YYYY-MM-DD a partir de componentes numéricos.
 */
function formatarData(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Avança um mês a partir de (ano, mes) retornando o próximo (ano, mes).
 */
function proximoMes(ano: number, mes: number): { ano: number; mes: number } {
  if (mes === 12) return { ano: ano + 1, mes: 1 };
  return { ano, mes: mes + 1 };
}

/**
 * Compara duas competências no formato 'YYYY-MM'.
 * Retorna negativo se a < b, 0 se iguais, positivo se a > b.
 */
function compararCompetencia(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Gera a string de competência 'YYYY-MM' a partir de componentes numéricos.
 */
function formatarCompetencia(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

/**
 * Extrai os componentes numéricos de uma competência 'YYYY-MM'.
 */
function parsearCompetencia(competencia: string): { ano: number; mes: number } {
  const [anoStr, mesStr] = competencia.split('-');
  return { ano: parseInt(anoStr, 10), mes: parseInt(mesStr, 10) };
}

/**
 * Extrai os componentes numéricos de uma data 'YYYY-MM-DD'.
 */
function parsearData(data: string): { ano: number; mes: number; dia: number } {
  const [anoStr, mesStr, diaStr] = data.split('-');
  return {
    ano: parseInt(anoStr, 10),
    mes: parseInt(mesStr, 10),
    dia: parseInt(diaStr, 10),
  };
}

/**
 * Adiciona N dias a uma data representada como string 'YYYY-MM-DD'.
 * Usa aritmética pura (sem new Date com fuso).
 */
function adicionarDias(data: string, dias: number): string {
  const { ano: a, mes: m, dia: d } = parsearData(data);
  // Converter para dias julianos simples e depois de volta
  let ano = a;
  let mes = m;
  let dia = d + dias;

  while (dia > diasNoMes(ano, mes)) {
    dia -= diasNoMes(ano, mes);
    const prox = proximoMes(ano, mes);
    ano = prox.ano;
    mes = prox.mes;
  }
  while (dia < 1) {
    // Recuar um mês
    if (mes === 1) { mes = 12; ano--; } else { mes--; }
    dia += diasNoMes(ano, mes);
  }
  return formatarData(ano, mes, dia);
}

/**
 * Determina as datas de vencimento de um modelo de recorrência em um dado mês.
 *
 * - mensal: o dia de data_inicio limitado ao último dia do mês.
 * - anual: só no mês de data_inicio (e somente no dia de data_inicio).
 * - semanal: todas as datas data_inicio + 7k que caem no mês.
 *
 * Nunca antes de data_inicio nem depois de data_encerramento.
 *
 * @param rec - Modelo de recorrência
 * @param competencia - Mês no formato 'YYYY-MM'
 * @returns Array de datas no formato 'YYYY-MM-DD'
 */
export function datasDoMes(
  rec: RecorrenciaLancamento,
  competencia: string
): string[] {
  const { ano: compAno, mes: compMes } = parsearCompetencia(competencia);
  const { ano: inicioAno, mes: inicioMes, dia: inicioDia } = parsearData(rec.data_inicio);
  const resultado: string[] = [];

  const dentroDoIntervalo = (dataStr: string): boolean => {
    if (dataStr < rec.data_inicio) return false;
    if (rec.data_encerramento && dataStr > rec.data_encerramento) return false;
    return true;
  };

  if (rec.frequencia === 'mensal') {
    // O dia de vencimento limitado ao último dia do mês
    const ultimoDia = diasNoMes(compAno, compMes);
    const dia = Math.min(inicioDia, ultimoDia);
    const dataStr = formatarData(compAno, compMes, dia);
    if (dentroDoIntervalo(dataStr)) {
      resultado.push(dataStr);
    }
  } else if (rec.frequencia === 'anual') {
    // Só no mês de data_inicio
    if (compMes === inicioMes) {
      const ultimoDia = diasNoMes(compAno, compMes);
      const dia = Math.min(inicioDia, ultimoDia);
      const dataStr = formatarData(compAno, compMes, dia);
      if (dentroDoIntervalo(dataStr)) {
        resultado.push(dataStr);
      }
    }
  } else if (rec.frequencia === 'semanal') {
    // Todas as datas data_inicio + 7k que caem no mês
    // Encontrar a primeira ocorrência no mês ou antes
    let dataAtual = rec.data_inicio;

    // Avançar até o início do mês (se data_inicio for antes do mês)
    const inicioDoMes = formatarData(compAno, compMes, 1);
    if (dataAtual < inicioDoMes) {
      // Quantos dias entre data_inicio e inicio do mês?
      // Vamos simplesmente iterar com saltos de 7 até entrar no mês
      while (dataAtual < inicioDoMes) {
        dataAtual = adicionarDias(dataAtual, 7);
      }
    }

    // Agora coletar todas as datas no mês
    const fimDoMes = formatarData(compAno, compMes, diasNoMes(compAno, compMes));
    while (dataAtual <= fimDoMes) {
      if (dentroDoIntervalo(dataAtual)) {
        resultado.push(dataAtual);
      }
      dataAtual = adicionarDias(dataAtual, 7);
    }
  }

  return resultado;
}

/**
 * Planeja os lançamentos a gerar para um modelo de recorrência.
 *
 * Regras:
 * - Itera de (ultima_competencia_gerada + 1) até o mês de hojeISO (máximo 12 meses por execução).
 * - ID determinístico: `lanc-rec-<rec.id>-<YYYY-MM-DD>`.
 * - Não gera se já existe lançamento com esse ID (mesmo pago).
 * - Modelo inativo => retorna [].
 * - Lançamentos gerados com status 'pendente'.
 *
 * @param rec - Modelo de recorrência
 * @param lancamentosExistentes - Todos os lançamentos do sistema
 * @param hojeISO - Data de hoje no formato 'YYYY-MM-DD'
 * @returns Array de novos lançamentos a criar
 */
export function planejarGeracao(
  rec: RecorrenciaLancamento,
  lancamentosExistentes: Lancamento[],
  hojeISO: string
): Lancamento[] {
  // Modelo inativo: não gera nada
  if (!rec.ativa) return [];

  const idsExistentes = new Set(lancamentosExistentes.map((l) => l.id));

  // Competência de hoje
  const hojeCompetencia = hojeISO.slice(0, 7); // 'YYYY-MM'

  // Próxima competência a gerar = ultima_competencia_gerada + 1 mês
  const { ano: ultAno, mes: ultMes } = parsearCompetencia(rec.ultima_competencia_gerada);
  const prox = proximoMes(ultAno, ultMes);
  let compAtualAno = prox.ano;
  let compAtualMes = prox.mes;

  const novosLancamentos: Lancamento[] = [];
  let iteracoes = 0;
  const MAX_ITERACOES = 12;

  while (iteracoes < MAX_ITERACOES) {
    const competencia = formatarCompetencia(compAtualAno, compAtualMes);

    // Não gerar além do mês atual (hoje)
    if (compararCompetencia(competencia, hojeCompetencia) > 0) break;

    // Obter as datas de vencimento do mês
    const datas = datasDoMes(rec, competencia);

    for (const dataVenc of datas) {
      const idDeterministico = `lanc-rec-${rec.id}-${dataVenc}`;

      // Se já existe, pular (idempotência)
      if (idsExistentes.has(idDeterministico)) continue;

      const novoLancamento: Lancamento = {
        id: idDeterministico,
        tipo: rec.tipo,
        descricao: rec.descricao,
        valor: rec.valor,
        data_vencimento: dataVenc,
        data_pagamento: null,
        status: 'pendente',
        conta_id: rec.conta_id,
        categoria_id: rec.categoria_id,
        ...(rec.contato_id ? { contato_id: rec.contato_id } : {}),
        ...(rec.projeto_id ? { projeto_id: rec.projeto_id } : {}),
        forma_pagamento: rec.forma_pagamento,
        recorrencia: rec.frequencia,
        grupo_recorrencia_id: rec.id,
        ...(rec.observacoes ? { observacoes: rec.observacoes } : {}),
        origem: 'manual',
        competencia,
        criado_em: new Date().toISOString(),
      };

      novosLancamentos.push(novoLancamento);
    }

    // Avançar para o próximo mês
    const prox2 = proximoMes(compAtualAno, compAtualMes);
    compAtualAno = prox2.ano;
    compAtualMes = prox2.mes;
    iteracoes++;
  }

  return novosLancamentos;
}

// ─── PARTE 23C: Edição nos próximos meses e encerramento de recorrência ───────

/**
 * Ajusta data_inicio mantendo um formato válido YYYY-MM-DD com o novo dia.
 * Se o mês da data_inicio original não suportar o novo dia (ex: fevereiro e novoDia 31),
 * procura um mês no mesmo ano que suporte o novo dia (ex: janeiro).
 */
export function ajustarDataInicioComNovoDia(dataInicioOriginal: string, novoDia: number): string {
  const { ano, mes } = parsearData(dataInicioOriginal);
  if (diasNoMes(ano, mes) >= novoDia) {
    return formatarData(ano, mes, novoDia);
  }
  for (let m = 1; m <= 12; m++) {
    if (diasNoMes(ano, m) >= novoDia) {
      return formatarData(ano, m, novoDia);
    }
  }
  return formatarData(ano, mes, Math.min(novoDia, diasNoMes(ano, mes)));
}

/**
 * Atualiza os campos do modelo de recorrência a partir das alterações feitas em um lançamento.
 * Função PURA: não causa efeitos colaterais.
 *
 * Se o dia do vencimento mudou, atualiza a data_inicio para valer nos meses seguintes.
 */
export function atualizarModeloRecorrencia(
  modelo: RecorrenciaLancamento,
  alteracoes: Partial<Lancamento>
): RecorrenciaLancamento {
  const atualizado: RecorrenciaLancamento = { ...modelo };

  if (alteracoes.descricao !== undefined) {
    atualizado.descricao = alteracoes.descricao;
  }
  if (alteracoes.valor !== undefined) {
    atualizado.valor = alteracoes.valor;
  }
  if (alteracoes.conta_id !== undefined) {
    atualizado.conta_id = alteracoes.conta_id;
  }
  if (alteracoes.categoria_id !== undefined) {
    atualizado.categoria_id = alteracoes.categoria_id;
  }
  if (alteracoes.contato_id !== undefined) {
    atualizado.contato_id = alteracoes.contato_id || undefined;
  }
  if (alteracoes.projeto_id !== undefined) {
    atualizado.projeto_id = alteracoes.projeto_id || undefined;
  }
  if (alteracoes.forma_pagamento !== undefined) {
    atualizado.forma_pagamento = alteracoes.forma_pagamento;
  }
  if (alteracoes.observacoes !== undefined) {
    atualizado.observacoes = alteracoes.observacoes || undefined;
  }
  if (alteracoes.data_vencimento) {
    const { dia: novoDia, mes: novoMes } = parsearData(alteracoes.data_vencimento);
    if (modelo.frequencia === 'anual') {
      const { ano } = parsearData(modelo.data_inicio);
      const diaLimitado = Math.min(novoDia, diasNoMes(ano, novoMes));
      atualizado.data_inicio = formatarData(ano, novoMes, diaLimitado);
    } else {
      atualizado.data_inicio = ajustarDataInicioComNovoDia(modelo.data_inicio, novoDia);
    }
  }

  return atualizado;
}

/**
 * Encerra um modelo de recorrência (ativa = false; data_encerramento = hoje).
 * Função PURA.
 */
export function encerrarRecorrencia(
  modelo: RecorrenciaLancamento,
  dataEncerramentoISO?: string
): RecorrenciaLancamento {
  const hoje = dataEncerramentoISO || new Date().toISOString().split('T')[0];
  return {
    ...modelo,
    ativa: false,
    data_encerramento: hoje,
  };
}

/**
 * Processa o modelo de recorrência após uma exclusão escopada:
 * - 'futuras' e 'todas' encerram o modelo (ativa = false; data_encerramento = hoje).
 * - 'so_esta' mantém a recorrência ativa (o mês excluído não volta).
 * Função PURA.
 */
export function processarExclusaoRecorrencia(
  modelo: RecorrenciaLancamento | null | undefined,
  escopo: EscopoExclusao,
  dataHojeISO?: string
): RecorrenciaLancamento | null | undefined {
  if (!modelo) return modelo;
  if (escopo === 'futuras' || escopo === 'todas') {
    return encerrarRecorrencia(modelo, dataHojeISO);
  }
  return { ...modelo };
}

/**
 * Verifica se um lançamento tem grupo_recorrencia_id E existe modelo cadastrado na coleção de recorrências.
 * Grupos antigos (sem modelo) retornam falso.
 * Função PURA.
 */
export function podeEditarProximos(
  lancamento: Lancamento | null | undefined,
  modelos: RecorrenciaLancamento[]
): boolean {
  if (!lancamento || !lancamento.grupo_recorrencia_id) return false;
  return modelos.some((m) => m.id === lancamento.grupo_recorrencia_id);
}

/**
 * Aplica as alterações de um lançamento aos lançamentos PENDENTES futuros do mesmo grupo de recorrência.
 * Função PURA: não causa efeitos colaterais nem mutações nos dados recebidos.
 *
 * Regras:
 * - Grupo = alvo.grupo_recorrencia_id. Se alvo não tiver grupo, altera apenas o alvo (se pendente).
 * - Apenas membros do mesmo grupo com status 'pendente' e data_vencimento >= alvo.data_vencimento.
 * - Nunca altera lançamento já pago (mesmo com vencimento futuro).
 * - Nunca altera lançamento com vencimento anterior ao do alvo.
 * - Nunca altera lançamentos de origem 'folha' ou 'transferencia'.
 * - Se alteracoes contiver data_vencimento, o novo dia é aplicado a cada lançamento dentro do seu mês,
 *   limitado ao último dia de cada mês (ex.: dia 31 em fevereiro vira 28, ou 29 em bissexto).
 *   Para o próprio alvo, a data_vencimento de alteracoes é mantida.
 */
export function aplicarEdicaoNosProximos(
  lancamentos: Lancamento[],
  alvo: Lancamento,
  alteracoes: Partial<Lancamento>
): Lancamento[] {
  const grupoId = alvo.grupo_recorrencia_id;
  if (!grupoId) {
    return lancamentos.map((item) => {
      if (item.id === alvo.id && item.status === 'pendente') {
        return {
          ...item,
          ...alteracoes,
        };
      }
      return item;
    });
  }

  const novoDia = alteracoes.data_vencimento
    ? parsearData(alteracoes.data_vencimento).dia
    : undefined;

  return lancamentos.map((item) => {
    // Apenas mesmo grupo de recorrência
    if (item.grupo_recorrencia_id !== grupoId) {
      return item;
    }

    // Nunca altera origem 'folha' ou 'transferencia'
    if (item.origem === 'folha' || item.origem === 'transferencia') {
      return item;
    }

    // Nunca altera lançamentos anteriores ao alvo
    if (item.data_vencimento < alvo.data_vencimento) {
      return item;
    }

    // Nunca altera lançamentos pagos
    if (item.status === 'pago') {
      return item;
    }

    // Apenas status pendente
    if (item.status !== 'pendente') {
      return item;
    }

    // Calcula a nova data de vencimento dentro do mês do lançamento
    let novaDataVenc: string | undefined = undefined;
    if (novoDia !== undefined) {
      if (item.id === alvo.id && alteracoes.data_vencimento) {
        novaDataVenc = alteracoes.data_vencimento;
      } else {
        const { ano, mes } = parsearData(item.data_vencimento);
        const diaLimitado = Math.min(novoDia, diasNoMes(ano, mes));
        novaDataVenc = formatarData(ano, mes, diaLimitado);
      }
    }

    return {
      ...item,
      ...(alteracoes.descricao !== undefined ? { descricao: alteracoes.descricao } : {}),
      ...(alteracoes.valor !== undefined ? { valor: alteracoes.valor } : {}),
      ...(alteracoes.conta_id !== undefined ? { conta_id: alteracoes.conta_id } : {}),
      ...(alteracoes.categoria_id !== undefined ? { categoria_id: alteracoes.categoria_id } : {}),
      ...(alteracoes.contato_id !== undefined ? { contato_id: alteracoes.contato_id || undefined } : {}),
      ...(alteracoes.projeto_id !== undefined ? { projeto_id: alteracoes.projeto_id || undefined } : {}),
      ...(alteracoes.forma_pagamento !== undefined ? { forma_pagamento: alteracoes.forma_pagamento } : {}),
      ...(alteracoes.observacoes !== undefined ? { observacoes: alteracoes.observacoes || undefined } : {}),
      ...(novaDataVenc !== undefined ? { data_vencimento: novaDataVenc } : {}),
    };
  });
}


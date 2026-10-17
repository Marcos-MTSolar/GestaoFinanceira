import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dbService, subscribe } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { usePrivacy } from '../context/PrivacyContext';
import { formatarMoeda, formatarDataBR, formatarCpfCnpj, formatarPercentual } from '../utils/formatters';
import { exportarTabelaGenericaCSV } from '../utils/csvExporter';
import { mesesDoPeriodo } from '../utils/periodo';
import { Logo } from '../components/Logo';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieChartIcon,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  Printer,
  Download,
  AlertTriangle,
  Building2,
  Users,
  SunMedium,
  CheckCircle2,
  Clock,
  DollarSign,
  Activity,
  ShieldAlert,
  Percent,
  FolderOpen,
  Filter,
  FileText,
  Search,
  Scale,
  Plus,
  Trash2
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { ItemManualBalanco, GrupoManualBalanco } from '../utils/balanco';

// B1: Paletas de cores para gráficos de categoria (independentes da cor cadastrada)
const PALETA_RECEITAS = ['#16A34A', '#2563EB', '#0891B2', '#CA8A04', '#7C3AED', '#0F766E', '#DB2777', '#475569'];
const PALETA_DESPESAS = ['#DC2626', '#EA580C', '#7C3AED', '#BE185D', '#CA8A04', '#7F1D1D', '#92400E', '#475569'];
const corPorIndice = (paleta: string[], i: number) => paleta[i % paleta.length];

type TipoRelatorio =
  | 'dre'
  | 'fluxo_caixa'
  | 'categorias'
  | 'lucratividade_projetos'
  | 'inadimplencia_contatos'
  | 'cheque_especial'
  | 'funcionarios_folha'
  | 'comparativo_mensal'
  | 'balanco_patrimonial';

export const Relatorios: React.FC = () => {
  const { usuario, isAdmin } = useAuth();
  const { formatarValor } = usePrivacy();

  const [relatorioAtivo, setRelatorioAtivo] = useState<TipoRelatorio>('dre');

  // Filtros de Período
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');

  const [periodoPreset, setPeriodoPreset] = useState<'ano_atual' | 'mes_atual' | 'ultimos_12' | 'personalizado'>('ano_atual');
  const [dataInicio, setDataInicio] = useState(`${anoAtual}-01-01`);
  const [dataFim, setDataFim] = useState(`${anoAtual}-12-31`);
  const [anoSelecionado, setAnoSelecionado] = useState<number>(anoAtual);

  // B1: Estados de rascunho para período personalizado
  const [inicioRascunho, setInicioRascunho] = useState(dataInicio);
  const [fimRascunho, setFimRascunho] = useState(dataFim);

  // Trigger para reatividade
  const [versaoDados, setVersaoDados] = useState(0);

  useEffect(() => {
    const unsubL = subscribe('lancamentos', () => setVersaoDados(v => v + 1));
    const unsubF = subscribe('funcionarios', () => setVersaoDados(v => v + 1));
    const unsubP = subscribe('projetos', () => setVersaoDados(v => v + 1));
    const unsubC = subscribe('contas', () => setVersaoDados(v => v + 1));
    const unsubCfg = subscribe('configuracoes', () => setVersaoDados(v => v + 1));
    const unsubFolha = subscribe('folha', () => setVersaoDados(v => v + 1));
    return () => {
      unsubL();
      unsubF();
      unsubP();
      unsubC();
      unsubCfg();
      unsubFolha();
    };
  }, []);

  // B1 e B5: Atualizar datas quando preset muda
  const handleMudarPreset = (preset: 'ano_atual' | 'mes_atual' | 'ultimos_12' | 'personalizado') => {
    setPeriodoPreset(preset);
    if (preset === 'ano_atual') {
      const ini = `${anoAtual}-01-01`;
      const fim = `${anoAtual}-12-31`;
      setDataInicio(ini);
      setDataFim(fim);
      setInicioRascunho(ini);
      setFimRascunho(fim);
      setAnoSelecionado(anoAtual);
    } else if (preset === 'mes_atual') {
      const ini = `${anoAtual}-${mesAtual}-01`;
      const ultimoDia = new Date(anoAtual, parseInt(mesAtual, 10), 0).getDate();
      const fim = `${anoAtual}-${mesAtual}-${String(ultimoDia).padStart(2, '0')}`;
      setDataInicio(ini);
      setDataFim(fim);
      setInicioRascunho(ini);
      setFimRascunho(fim);
      setAnoSelecionado(anoAtual);
    } else if (preset === 'ultimos_12') {
      const d12 = new Date();
      d12.setFullYear(d12.getFullYear() - 1);
      const ini = d12.toISOString().split('T')[0];
      const fim = hoje.toISOString().split('T')[0];
      setDataInicio(ini);
      setDataFim(fim);
      setInicioRascunho(ini);
      setFimRascunho(fim);
    } else if (preset === 'personalizado') {
      setInicioRascunho(dataInicio);
      setFimRascunho(dataFim);
    }
  };

  // B2 e B3: Validação e execução de pesquisa no modo personalizado
  const dataInvalidaMaior = Boolean(inicioRascunho && fimRascunho && inicioRascunho > fimRascunho);
  const pesquisarDesabilitado = !inicioRascunho || !fimRascunho || dataInvalidaMaior;

  const handlePesquisar = () => {
    if (pesquisarDesabilitado) return;
    setDataInicio(inicioRascunho);
    setDataFim(fimRascunho);
  };


  // A6: datas efetivas — se início > fim, usa os dois valores trocados nos cálculos
  const periodoInvertido = dataInicio > dataFim;
  const iniEfetivo = periodoInvertido ? dataFim : dataInicio;
  const fimEfetivo = periodoInvertido ? dataInicio : dataFim;

  // A3: dadosDRE usa iniEfetivo/fimEfetivo para respeitar período invertido
  const dadosDRE = useMemo(() => {
    return dbService.gerarRelatorioDRE(iniEfetivo, fimEfetivo);
  }, [iniEfetivo, fimEfetivo, versaoDados]);

  // A4: Fluxo de Caixa — agrega todos os anos do período e filtra meses presentes

  const dadosFluxo = useMemo(() => {
    const meses = mesesDoPeriodo(iniEfetivo, fimEfetivo);
    const anoIni = Number(iniEfetivo.slice(0, 4));
    const anoFim = Number(fimEfetivo.slice(0, 4));
    const todosMeses: ReturnType<typeof dbService.gerarRelatorioFluxoCaixa>['meses'] = [];
    for (let a = anoIni; a <= anoFim; a++) {
      const dados = dbService.gerarRelatorioFluxoCaixa(a);
      dados.meses.forEach((m) => {
        const chave = `${a}-${String(m.mesIndex).padStart(2, '0')}`;
        if (meses.includes(chave)) todosMeses.push(m);
      });
    }
    return { ano: anoIni === anoFim ? anoIni : anoIni, meses: todosMeses };
  }, [iniEfetivo, fimEfetivo, versaoDados]);

  const dadosCategorias = useMemo(() => {
    const todos = dbService.getLancamentos().filter(
      l => l.status === 'pago' && l.origem !== 'transferencia'
    );
    const categorias = dbService.getCategorias();

    const filtrados = todos.filter(l => {
      const dt = l.data_pagamento || l.data_vencimento;
      return dt >= iniEfetivo && dt <= fimEfetivo;
    });

    const receitasMap = new Map<string, number>();
    const despesasMap = new Map<string, number>();
    let totalRec = 0;
    let totalDes = 0;

    filtrados.forEach(l => {
      if (l.tipo === 'receita') {
        const chave = categorias.some(cat => cat.id === l.categoria_id) ? l.categoria_id : 'sem_categoria';
        receitasMap.set(chave, (receitasMap.get(chave) || 0) + l.valor);
        totalRec += l.valor;
      } else {
        const chave = categorias.some(cat => cat.id === l.categoria_id) ? l.categoria_id : 'sem_categoria';
        despesasMap.set(chave, (despesasMap.get(chave) || 0) + l.valor);
        totalDes += l.valor;
      }
    });

    // B2: ordena primeiro, depois atribui cor da paleta por índice (maior fatia = 1ª cor)
    const listaReceitas = Array.from(receitasMap.entries()).map(([id, val]) => {
      const c = categorias.find(cat => cat.id === id);
      return {
        id,
        nome: c ? c.nome : 'Sem categoria',
        cor: '', // preenchido após sort
        valor: val,
        percentual: totalRec > 0 ? +((val / totalRec) * 100).toFixed(1) : 0,
      };
    }).sort((a, b) => b.valor - a.valor).map((item, i) => ({
      ...item,
      cor: corPorIndice(PALETA_RECEITAS, i),
    }));

    const listaDespesas = Array.from(despesasMap.entries()).map(([id, val]) => {
      const c = categorias.find(cat => cat.id === id);
      return {
        id,
        nome: c ? c.nome : 'Sem categoria',
        cor: '', // preenchido após sort
        valor: val,
        percentual: totalDes > 0 ? +((val / totalDes) * 100).toFixed(1) : 0,
      };
    }).sort((a, b) => b.valor - a.valor).map((item, i) => ({
      ...item,
      cor: corPorIndice(PALETA_DESPESAS, i),
    }));

    return {
      totalRec,
      totalDes,
      listaReceitas,
      listaDespesas,
    };
  }, [iniEfetivo, fimEfetivo, versaoDados]);

  const dadosProjetos = useMemo(() => {
    return dbService.gerarRelatorioLucratividadeProjetos();
  }, [versaoDados]);

  const dadosInadimplencia = useMemo(() => {
    return dbService.gerarRelatorioInadimplenciaContatos();
  }, [versaoDados]);

  const dadosCheque = useMemo(() => {
    return dbService.gerarRelatorioChequeEspecial(iniEfetivo, fimEfetivo);
  }, [iniEfetivo, fimEfetivo, versaoDados]);

  // A4: Funcionários & Folha — passa as datas para filtrar lançamentos de folha
  const dadosFuncionarios = useMemo(() => {
    const anoIni = Number(iniEfetivo.slice(0, 4));
    return dbService.gerarRelatorioFuncionariosFolha(anoIni, iniEfetivo, fimEfetivo);
  }, [iniEfetivo, fimEfetivo, versaoDados]);

  // A4: Comparativo — agrega anos do período e filtra meses
  const dadosComparativo = useMemo(() => {
    const meses = mesesDoPeriodo(iniEfetivo, fimEfetivo);
    const anoIni = Number(iniEfetivo.slice(0, 4));
    const anoFim = Number(fimEfetivo.slice(0, 4));
    type MesComp = ReturnType<typeof dbService.gerarRelatorioComparativoMesAMes>['meses'][number];
    const todosMeses: MesComp[] = [];
    for (let a = anoIni; a <= anoFim; a++) {
      const dados = dbService.gerarRelatorioComparativoMesAMes(a);
      dados.meses.forEach((m) => {
        const chave = `${a}-${String(m.mesIndex).padStart(2, '0')}`;
        if (meses.includes(chave)) todosMeses.push(m);
      });
    }
    return { ano: anoIni, meses: todosMeses };
  }, [iniEfetivo, fimEfetivo, versaoDados]);

  // G2: Balanço Patrimonial Gerencial (não afetado pelo período selecionado)
  const dadosBalanco = useMemo(() => {
    return dbService.gerarRelatorioBalanco();
  }, [versaoDados]);

  // G4: Controle do Modal de Ajustes Manuais
  const [modalAjustesAberto, setModalAjustesAberto] = useState(false);
  const [itensAjuste, setItensAjuste] = useState<ItemManualBalanco[]>([]);
  const [erroAjustes, setErroAjustes] = useState<string | null>(null);

  const abrirModalAjustes = () => {
    setItensAjuste(dbService.getItensBalancoManual());
    setErroAjustes(null);
    setModalAjustesAberto(true);
  };

  const handleSalvarAjustes = () => {
    for (let i = 0; i < itensAjuste.length; i++) {
      const item = itensAjuste[i];
      if (!item.nome.trim()) {
        setErroAjustes(`O item #${i + 1} precisa ter um nome preenchido.`);
        return;
      }
      if (!item.grupo) {
        setErroAjustes(`O item #${i + 1} precisa ter um grupo selecionado.`);
        return;
      }
      if (typeof item.valor !== 'number' || isNaN(item.valor) || item.valor <= 0) {
        setErroAjustes(`O item "${item.nome}" precisa ter um valor maior que zero.`);
        return;
      }
    }

    const timestamp = Date.now();
    const itensFinal: ItemManualBalanco[] = itensAjuste.map((item, n) => ({
      id: item.id || `bal-${timestamp}-${n}`,
      grupo: item.grupo,
      nome: item.nome.trim(),
      valor: +Number(item.valor).toFixed(2),
    }));

    dbService.saveItensBalancoManual(itensFinal);
    setModalAjustesAberto(false);
    setVersaoDados((v) => v + 1);
  };

  // Função de Impressão
  const handleImprimir = () => {
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => window.print(), 400);
  };

  // Exportação CSV do Relatório Selecionado
  const handleExportarCSV = () => {
    switch (relatorioAtivo) {
      case 'dre': {
        const colunas = ['Grupo / Categoria', 'Tipo', 'Valor (R$)', '% sobre Receita'];
        const linhas: Array<Array<string | number>> = [];
        dadosDRE.linhasReceitas.forEach(r => {
          linhas.push([r.nome, 'RECEITA', r.valor, `${r.percentualReceita}%`]);
        });
        dadosDRE.linhasDespesas.forEach(d => {
          linhas.push([d.nome, 'DESPESA', d.valor, `${d.percentualReceita}%`]);
        });
        linhas.push(['RESULTADO LÍQUIDO', 'LUCRO/PREJUÍZO', dadosDRE.resultadoLiquido, `${dadosDRE.margemLiquida}%`]);
        exportarTabelaGenericaCSV('DRE_Simplificado', colunas, linhas);
        break;
      }
      case 'fluxo_caixa': {
        const colunas = ['Mês', 'Realizado Entradas (R$)', 'Realizado Saídas (R$)', 'Realizado Líquido (R$)', 'Previsto Entradas (R$)', 'Previsto Saídas (R$)', 'Previsto Líquido (R$)'];
        const linhas = dadosFluxo.meses.map(m => [
          m.rotulo,
          m.realizadoEntradas,
          m.realizadoSaidas,
          m.realizadoLiquido,
          m.previstoEntradas,
          m.previstoSaidas,
          m.previstoLiquido,
        ]);
        exportarTabelaGenericaCSV(`Fluxo_Caixa_${dadosFluxo.ano}`, colunas, linhas);
        break;
      }
      case 'lucratividade_projetos': {
        const colunas = ['Projeto', 'Cliente', 'Status', 'Contratado (R$)', 'Recebido (R$)', 'A Receber (R$)', 'Custos Obra (R$)', 'Lucro Realizado (R$)', 'Margem (%)', 'Progresso (%)'];
        const linhas = dadosProjetos.fichas.map(f => [
          f.projeto.nome,
          f.projeto.cliente,
          f.projeto.status.toUpperCase(),
          f.valorContratado,
          f.receitasPagas,
          f.receitaAReceber,
          f.custosRealizados,
          f.lucroRealizado,
          `${f.margemRealizada}%`,
          `${f.percentualRecebido}%`,
        ]);
        exportarTabelaGenericaCSV('Lucratividade_Projetos', colunas, linhas);
        break;
      }
      case 'inadimplencia_contatos': {
        const colunas = ['Contato', 'Tipo', 'CNPJ/CPF', 'Total Devido (R$)', 'Total Vencido (R$)', 'Dias de Atraso'];
        const linhas: Array<Array<string | number>> = [];
        dadosInadimplencia.quemNosDeve.forEach(d => {
          linhas.push([d.nome, 'QUEM NOS DEVE (CLIENTE)', d.cpfCnpj, d.totalDevido, d.totalVencido, d.diasMaiorAtraso]);
        });
        dadosInadimplencia.aQuemDevemos.forEach(c => {
          linhas.push([c.nome, 'A QUEM DEVEMOS (FORNECEDOR)', c.cpfCnpj, c.totalDevido, c.totalVencido, '-']);
        });
        exportarTabelaGenericaCSV('Inadimplencia_Contatos', colunas, linhas);
        break;
      }
      case 'cheque_especial': {
        const colunas = ['Conta Bancária', 'Saldo Real Atual (R$)', 'Cheque Utilizado Atual (R$)', 'Limite (R$)', 'Dias no Negativo', 'Maior Pico Usado (R$)', 'Juros Estimados no Período (R$)'];
        const linhas = dadosCheque.detalhesPorConta.map(c => [
          c.conta.nome,
          c.saldoAtual,
          c.chequeUsadoAtual,
          c.limite,
          c.diasNegativo,
          c.picoUso,
          c.jurosEstimados,
        ]);
        exportarTabelaGenericaCSV('Uso_Cheque_Especial', colunas, linhas);
        break;
      }
      case 'funcionarios_folha': {
        const colunas = ['Colaborador', 'Cargo', 'Setor', 'Contrato', 'Salário Base (R$)', 'Benefícios (R$)', 'Encargos / Provisões (R$)', 'Custo Total Mensal (R$)'];
        const linhas = dadosFuncionarios.porFuncionario.map(f => [
          f.funcionario.nome,
          f.funcionario.cargo,
          f.funcionario.setor,
          f.funcionario.tipo_contrato,
          f.salarioBase,
          f.beneficios,
          f.encargosProvisoes,
          f.custoTotalMensal,
        ]);
        exportarTabelaGenericaCSV(`Folha_Funcionarios_${dadosFuncionarios.ano}`, colunas, linhas);
        break;
      }
      case 'comparativo_mensal': {
        const colunas = ['Mês', 'Receitas (R$)', 'Variação Receitas (%)', 'Despesas (R$)', 'Variação Despesas (%)', 'Resultado Líquido (R$)'];
        const linhas = dadosComparativo.meses.map(m => [
          m.rotulo,
          m.realizadoEntradas,
          `${m.variacaoReceitas}%`,
          m.realizadoSaidas,
          `${m.variacaoDespesas}%`,
          m.realizadoLiquido,
        ]);
        exportarTabelaGenericaCSV(`Comparativo_Mensal_${dadosComparativo.ano}`, colunas, linhas);
        break;
      }
      case 'balanco_patrimonial': {
        const colunas = ['Grupo', 'Item', 'Origem', 'Valor (R$)'];
        const linhas: Array<Array<string | number>> = [];
        dadosBalanco.ativoCirculante.forEach((l) => linhas.push(['Ativo Circulante', l.nome, l.origem, l.valor]));
        linhas.push(['Ativo Circulante', 'TOTAL ATIVO CIRCULANTE', 'total', dadosBalanco.totais.ativoCirculante]);
        dadosBalanco.ativoNaoCirculante.forEach((l) => linhas.push(['Ativo Não Circulante', l.nome, l.origem, l.valor]));
        linhas.push(['Ativo Não Circulante', 'TOTAL ATIVO NÃO CIRCULANTE', 'total', dadosBalanco.totais.ativoNaoCirculante]);
        linhas.push(['Ativo', 'TOTAL DO ATIVO', 'total', dadosBalanco.totais.ativo]);
        dadosBalanco.passivoCirculante.forEach((l) => linhas.push(['Passivo Circulante', l.nome, l.origem, l.valor]));
        linhas.push(['Passivo Circulante', 'TOTAL PASSIVO CIRCULANTE', 'total', dadosBalanco.totais.passivoCirculante]);
        dadosBalanco.passivoNaoCirculante.forEach((l) => linhas.push(['Passivo Não Circulante', l.nome, l.origem, l.valor]));
        linhas.push(['Passivo Não Circulante', 'TOTAL PASSIVO NÃO CIRCULANTE', 'total', dadosBalanco.totais.passivoNaoCirculante]);
        dadosBalanco.patrimonioLiquido.forEach((l) => linhas.push(['Patrimônio Líquido', l.nome, l.origem, l.valor]));
        linhas.push(['Patrimônio Líquido', 'TOTAL PATRIMÔNIO LÍQUIDO', 'total', dadosBalanco.totais.patrimonioLiquido]);
        linhas.push(['Passivo + PL', 'TOTAL PASSIVO + PL', 'total', dadosBalanco.totais.passivoMaisPL]);
        exportarTabelaGenericaCSV(`Balanco_Patrimonial_${dadosBalanco.dataBase}`, colunas, linhas);
        break;
      }
      default: {
        const colunas = ['Categoria', 'Tipo', 'Valor (R$)', '% sobre Total'];
        const linhas: Array<Array<string | number>> = [];
        dadosCategorias.listaReceitas.forEach(r => {
          linhas.push([r.nome, 'RECEITA', r.valor, `${r.percentual}%`]);
        });
        dadosCategorias.listaDespesas.forEach(d => {
          linhas.push([d.nome, 'DESPESA', d.valor, `${d.percentual}%`]);
        });
        exportarTabelaGenericaCSV('Categorias_Receitas_Despesas', colunas, linhas);
      }
    }
  };

  const TITULOS_RELATORIOS: Record<TipoRelatorio, { titulo: string; desc: string }> = {
    dre: {
      titulo: '1. DRE Simplificado Gerencial',
      desc: 'Receitas por categoria operacional subtraídas de custos e despesas com apuração de margem líquida.',
    },
    fluxo_caixa: {
      titulo: '2. Fluxo de Caixa: Realizado vs Previsto',
      desc: 'Comparativo mensal e diário de entradas e saídas liquidadas versus vencimentos programados.',
    },
    categorias: {
      titulo: '3. Receitas e Despesas por Categoria',
      desc: 'Concentração de valores faturados e custos nos centros de custo do plano fotovoltaico.',
    },
    lucratividade_projetos: {
      titulo: '4. Lucratividade por Projeto e Usina',
      desc: 'Contratos, faturamento realizado, custos diretos de materiais/mão de obra e margem por obra.',
    },
    inadimplencia_contatos: {
      titulo: '5. Quem mais nos deve & A quem devemos',
      desc: 'Ranking de clientes com duplicatas a receber/vencidas e fornecedores a pagar.',
    },
    cheque_especial: {
      titulo: '6. Relatório de Uso do Cheque Especial',
      desc: 'Mapeamento de dias no saldo negativo, picos de utilização de limite e estimativa de juros bancários.',
    },
    funcionarios_folha: {
      titulo: '7. Custos de Funcionários & Setores',
      desc: 'Custo total empresa com encargos sociais por colaborador, por setor e evolução anual.',
    },
    comparativo_mensal: {
      titulo: '8. Comparativo Mês a Mês',
      desc: 'Evolução de faturamento, crescimento de despesas operacionais e oscilação percentual.',
    },
    balanco_patrimonial: {
      titulo: '9. Balanço Patrimonial Gerencial',
      desc: 'Posição patrimonial atual: ativo, passivo e patrimônio líquido, com dados do sistema e ajustes manuais.',
    },
  };

  return (
    <div className="space-y-6 pb-20">

      {/* CABEÇALHO PARA TELA (NÃO IMPRESSO) */}
      <div className="print:hidden bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-[#003064] text-[#FCBC00]">
              <BarChart3 className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold text-[#1A4A85] uppercase tracking-wider">
              Controladoria & Inteligência Financeira
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#003064] mt-1">
            Relatórios Financeiros & DRE MT Solar
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Demonstrativos gerenciais, fluxo de caixa, lucratividade de usinas solares e custos de folha.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportarCSV}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs border border-slate-200 bg-white hover:bg-slate-50 text-[#003064] transition-all cursor-pointer shadow-xs"
            title="Exportar para Excel / CSV"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handleImprimir}
            className="flex items-center gap-1.5 bg-[#003064] hover:bg-[#00204A] text-white px-4 py-2.5 rounded-xl font-semibold text-xs shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
            title="Versão para Impressão / Salvar PDF"
          >
            <Printer className="w-4 h-4 text-[#FCBC00]" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* CABEÇALHO DE IMPRESSÃO OFICIAL (APARECE APENAS NO PRINT / PDF) */}
      <div className="hidden print:block bg-white p-6 border-b-2 border-[#003064] mb-6">
        <div className="flex items-center justify-between">
          <div>
            <Logo size="lg" withWhiteBadge={false} />
            <p className="text-xs text-slate-500 mt-1 font-semibold print:text-[9pt]">
              MT Solar – Energia Renovável | Gestão Financeira Empresarial
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-serif font-bold text-base text-[#003064] print:text-lg">
              {TITULOS_RELATORIOS[relatorioAtivo].titulo}
            </p>
            <p className="text-[11px] text-slate-500">
              {relatorioAtivo === 'balanco_patrimonial'
                ? `Posição em: ${formatarDataBR(dadosBalanco.dataBase)}`
                : `Período: ${formatarDataBR(dataInicio)} até ${formatarDataBR(dataFim)}`}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')} por {usuario?.nome || 'Administrador'}
            </p>
          </div>
        </div>
      </div>

      {/* SELEÇÃO DO TIPO DE RELATÓRIO (9 RELATÓRIOS OFICIAIS) */}
      <div className="print:hidden bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs overflow-x-auto print:overflow-visible">
        <div className="flex items-center gap-1.5 min-w-[950px]">
          {(
            [
              { id: 'dre', label: '1. DRE Simplificado', icon: FileText },
              { id: 'fluxo_caixa', label: '2. Fluxo de Caixa', icon: TrendingUp },
              { id: 'categorias', label: '3. Por Categoria', icon: PieChartIcon },
              { id: 'lucratividade_projetos', label: '4. Projetos & Usinas', icon: SunMedium },
              { id: 'inadimplencia_contatos', label: '5. Inadimplência', icon: AlertTriangle },
              { id: 'cheque_especial', label: '6. Cheque Especial', icon: ShieldAlert },
              { id: 'funcionarios_folha', label: '7. Funcionários & Folha', icon: Users },
              { id: 'comparativo_mensal', label: '8. Comparativo Mês a Mês', icon: BarChart3 },
              { id: 'balanco_patrimonial', label: '9. Balanço Patrimonial', icon: Scale },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const ativo = relatorioAtivo === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setRelatorioAtivo(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  ativo
                    ? 'bg-[#003064] text-white shadow-xs border-b-2 border-[#FCBC00]'
                    : 'text-slate-600 hover:text-[#003064] hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${ativo ? 'text-[#FCBC00]' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BARRA DE FILTRO DE PERÍODO */}
      <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-700">Período:</span>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => handleMudarPreset('ano_atual')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  periodoPreset === 'ano_atual' ? 'bg-white text-[#003064] shadow-xs' : 'text-slate-600'
                }`}
              >
                Ano Atual ({anoAtual})
              </button>
              <button
                onClick={() => handleMudarPreset('mes_atual')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  periodoPreset === 'mes_atual' ? 'bg-white text-[#003064] shadow-xs' : 'text-slate-600'
                }`}
              >
                Mês Atual
              </button>
              <button
                onClick={() => handleMudarPreset('ultimos_12')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  periodoPreset === 'ultimos_12' ? 'bg-white text-[#003064] shadow-xs' : 'text-slate-600'
                }`}
              >
                Últimos 12 Meses
              </button>
              <button
                onClick={() => handleMudarPreset('personalizado')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  periodoPreset === 'personalizado' ? 'bg-white text-[#003064] shadow-xs' : 'text-slate-600'
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>

          {periodoPreset === 'personalizado' && (
            <div className="flex items-center gap-2 text-xs flex-wrap w-full sm:w-auto justify-start sm:justify-end">
              <input
                type="date"
                value={inicioRascunho}
                onChange={(e) => setInicioRascunho(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePesquisar();
                }}
                className={`px-2.5 py-1.5 border rounded-lg text-slate-700 bg-white ${
                  dataInvalidaMaior ? 'border-red-400' : 'border-slate-300'
                }`}
              />
              <span className="text-slate-400">até</span>
              <input
                type="date"
                value={fimRascunho}
                onChange={(e) => setFimRascunho(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePesquisar();
                }}
                className={`px-2.5 py-1.5 border rounded-lg text-slate-700 bg-white ${
                  dataInvalidaMaior ? 'border-red-400' : 'border-slate-300'
                }`}
              />
              <button
                onClick={handlePesquisar}
                disabled={pesquisarDesabilitado}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#003064] text-white rounded-lg font-semibold hover:bg-[#002248] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Pesquisar</span>
              </button>
              <button
                onClick={() => handleMudarPreset('ano_atual')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Limpar
              </button>
              {dataInvalidaMaior && (
                <span className="text-xs font-semibold text-red-600">
                  A data inicial é maior que a final
                </span>
              )}
            </div>
          )}
        </div>

        {/* B4: Período aplicado sempre visível em todos os presets */}
        <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 font-medium flex items-center flex-wrap gap-1.5">
          <span>
            Período aplicado: <strong>{formatarDataBR(dataInicio)}</strong> até <strong>{formatarDataBR(dataFim)}</strong>
          </span>
          {periodoPreset === 'personalizado' &&
            (inicioRascunho !== dataInicio || fimRascunho !== dataFim) && (
              <span className="text-amber-600 font-semibold">
                — Alterações ainda não aplicadas — clique em Pesquisar
              </span>
            )}
        </div>
      </div>

      {/* CONTEÚDO ESPECÍFICO DE CADA RELATÓRIO */}

      {/* 1. DRE SIMPLIFICADO */}
      {relatorioAtivo === 'dre' && (
        <div className="space-y-6">
          {/* Cards Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 print:grid-cols-2">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Receita Bruta Realizada</span>
              <p className="font-num text-2xl font-bold text-emerald-600 mt-1 print:text-xl">
                {formatarValor(dadosDRE.receitaTotal)}
              </p>
              <span className="text-[11px] text-slate-400">Total faturado no período</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Custos e Despesas Totais</span>
              <p className="font-num text-2xl font-bold text-red-600 mt-1 print:text-xl">
                {formatarValor(dadosDRE.despesaTotal)}
              </p>
              <span className="text-[11px] text-slate-400">Operacional, insumos e equipes</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Resultado Líquido do Exercício</span>
              <p className={`font-num text-2xl font-bold mt-1 print:text-xl ${dadosDRE.resultadoLiquido >= 0 ? 'text-[#003064]' : 'text-red-600'}`}>
                {formatarValor(dadosDRE.resultadoLiquido)}
              </p>
              <span className="text-[11px] text-slate-400">Receitas (-) Despesas</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Margem Líquida</span>
              <p className="font-num text-2xl font-bold text-[#FCBC00] mt-1 print:text-xl">
                {formatarPercentual(dadosDRE.margemLiquida)}
              </p>
              <span className="text-[11px] text-slate-400">% líquida sobre a receita bruta</span>
            </div>
          </div>

          {/* Tabelas de DRE Detalhadas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Receitas */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <h3 className="font-serif font-bold text-base text-[#16A34A] mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Receitas por Categoria (+)</span>
                <span className="text-xs font-bold text-slate-500">{formatarValor(dadosDRE.receitaTotal)}</span>
              </h3>
              <div className="space-y-2">
                {dadosDRE.linhasReceitas.map((r, i) => (
                  <div key={r.categoriaId} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: corPorIndice(PALETA_RECEITAS, i) }} />
                      <span className="font-semibold text-slate-800">{r.nome}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-num font-bold text-emerald-700 block">{formatarValor(r.valor)}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{formatarPercentual(r.percentualReceita)} da receita</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Despesas */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <h3 className="font-serif font-bold text-base text-[#DC2626] mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Despesas por Categoria (-)</span>
                <span className="text-xs font-bold text-slate-500">{formatarValor(dadosDRE.despesaTotal)}</span>
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 print:max-h-none print:overflow-visible">
                {dadosDRE.linhasDespesas.map((d, i) => (
                  <div key={d.categoriaId} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: corPorIndice(PALETA_DESPESAS, i) }} />
                      <span className="font-semibold text-slate-800">{d.nome}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-num font-bold text-red-600 block">{formatarValor(d.valor)}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{formatarPercentual(d.percentualReceita)} da receita</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. FLUXO DE CAIXA: REALIZADO VS PREVISTO */}
      {relatorioAtivo === 'fluxo_caixa' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 print:shadow-none print:border print:border-slate-300 print:rounded-none print:p-3">
            <div className="flex items-center justify-between mb-4 print:mb-2">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#003064]">
                  Fluxo de Caixa Mensal
                </h3>
                <p className="text-xs text-slate-500">
                  Comparativo entre o faturamento efetivamente pago no banco e o volume previsto por data de vencimento.
                </p>
                <p className="text-xs text-slate-500 print:hidden">
                  Período: {formatarDataBR(iniEfetivo)} até {formatarDataBR(fimEfetivo)}
                </p>
              </div>
            </div>

            <div className="h-80 w-full mb-6 print:hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosFluxo.meses} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatarValor(Number(v))} />
                  <Legend />
                  <Bar dataKey="realizadoEntradas" name="Realizado Entradas" fill="#003064" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="realizadoSaidas" name="Realizado Saídas" fill="#FCBC00" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="previstoEntradas" name="Previsto Entradas" fill="#1A4A85" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="previstoSaidas" name="Previsto Saídas" fill="#DC2626" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="hidden print:block mb-2">
              <BarChart width={640} height={260} data={dadosFluxo.meses} margin={{ top: 5, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="rotulo" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="realizadoEntradas" name="Realizado Entradas" fill="#003064" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="realizadoSaidas" name="Realizado Saídas" fill="#FCBC00" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="previstoEntradas" name="Previsto Entradas" fill="#1A4A85" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="previstoSaidas" name="Previsto Saídas" fill="#DC2626" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </div>

            <div className="overflow-x-auto print:overflow-visible print-avoid-break">
              <table className="w-full text-left text-xs text-slate-600 print:table-fixed print:text-[8.5pt] [&_th]:print:border [&_th]:print:border-slate-300 [&_td]:print:border [&_td]:print:border-slate-300">
                <thead className="bg-[#F5F7FA] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 print:px-1.5 print:py-1 print:whitespace-normal">Mês</th>
                    <th className="py-2.5 px-3 text-right print:px-1.5 print:py-1 print:whitespace-normal">Realiz. Entradas</th>
                    <th className="py-2.5 px-3 text-right print:px-1.5 print:py-1 print:whitespace-normal">Realiz. Saídas</th>
                    <th className="py-2.5 px-3 text-right print:px-1.5 print:py-1 print:whitespace-normal">Resultado Caixa</th>
                    <th className="py-2.5 px-3 text-right print:px-1.5 print:py-1 print:whitespace-normal">Prev. Entradas</th>
                    <th className="py-2.5 px-3 text-right print:px-1.5 print:py-1 print:whitespace-normal">Prev. Saídas</th>
                    <th className="py-2.5 px-3 text-right print:px-1.5 print:py-1 print:whitespace-normal">Resultado Previsto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dadosFluxo.meses.map((m) => (
                    <tr key={m.rotulo} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-800 print:px-1.5 print:py-1">{m.rotulo}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-700 print:px-1.5 print:py-1">{formatarValor(m.realizadoEntradas)}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-red-600 print:px-1.5 print:py-1">{formatarValor(m.realizadoSaidas)}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${m.realizadoLiquido >= 0 ? 'text-[#003064]' : 'text-red-700'} print:px-1.5 print:py-1`}>
                        {formatarValor(m.realizadoLiquido)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500 print:px-1.5 print:py-1">{formatarValor(m.previstoEntradas)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500 print:px-1.5 print:py-1">{formatarValor(m.previstoSaidas)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-700 print:px-1.5 print:py-1">{formatarValor(m.previstoLiquido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. RECEITAS E DESPESAS POR CATEGORIA */}
      {relatorioAtivo === 'categorias' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico Rosca Despesas */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <h3 className="font-serif font-bold text-base text-[#003064] mb-1">
                Composição de Despesas por Centro de Custo
              </h3>
              <p className="text-xs text-slate-500 mb-4">Total: {formatarValor(dadosCategorias.totalDes)}</p>
              
              <div className="h-64 w-full print:hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosCategorias.listaDespesas}
                      dataKey="valor"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {dadosCategorias.listaDespesas.map((d) => (
                        <Cell key={d.id} fill={d.cor} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatarValor(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="hidden print:flex justify-center">
                <PieChart width={640} height={240}>
                  <Pie
                    data={dadosCategorias.listaDespesas}
                    dataKey="valor"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {dadosCategorias.listaDespesas.map((d) => (
                      <Cell key={d.id} fill={d.cor} />
                    ))}
                  </Pie>
                </PieChart>
              </div>

              <div className="space-y-2 mt-4 max-h-56 overflow-y-auto pr-1 print:max-h-none print:overflow-visible">
                {dadosCategorias.listaDespesas.map((d) => (
                  <div key={d.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.cor }} />
                      <strong className="text-slate-800">{d.nome}</strong>
                    </span>
                    <span>{formatarValor(d.valor)} ({formatarPercentual(d.percentual)})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico Rosca Receitas */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <h3 className="font-serif font-bold text-base text-[#003064] mb-1">
                Composição de Receitas da MT Solar
              </h3>
              <p className="text-xs text-slate-500 mb-4">Total: {formatarValor(dadosCategorias.totalRec)}</p>

              <div className="h-64 w-full print:hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosCategorias.listaReceitas}
                      dataKey="valor"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {dadosCategorias.listaReceitas.map((r) => (
                        <Cell key={r.id} fill={r.cor} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatarValor(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="hidden print:flex justify-center">
                <PieChart width={640} height={240}>
                  <Pie
                    data={dadosCategorias.listaReceitas}
                    dataKey="valor"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {dadosCategorias.listaReceitas.map((r) => (
                      <Cell key={r.id} fill={r.cor} />
                    ))}
                  </Pie>
                </PieChart>
              </div>

              <div className="space-y-2 mt-4 max-h-56 overflow-y-auto pr-1 print:max-h-none print:overflow-visible">
                {dadosCategorias.listaReceitas.map((r) => (
                  <div key={r.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.cor }} />
                      <strong className="text-slate-800">{r.nome}</strong>
                    </span>
                    <span>{formatarValor(r.valor)} ({formatarPercentual(r.percentual)})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. LUCRATIVIDADE POR PROJETO */}
      {relatorioAtivo === 'lucratividade_projetos' && (
        <div className="space-y-6">
          {/* A5: aviso de que este relatório não depende do período */}
          <p className="text-xs text-slate-400 font-medium">
            Posição atual — não depende do período selecionado
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 print:grid-cols-2">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Contratado</span>
              <p className="font-num text-2xl font-bold text-[#003064] mt-0.5 print:text-xl">{formatarValor(dadosProjetos.totalContratado)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Faturado em Caixa</span>
              <p className="font-num text-2xl font-bold text-emerald-600 mt-0.5 print:text-xl">{formatarValor(dadosProjetos.totalRecebido)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Custos Obras Realizados</span>
              <p className="font-num text-2xl font-bold text-red-600 mt-0.5 print:text-xl">{formatarValor(dadosProjetos.totalCustosRealizados)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Lucro Realizado Global</span>
              <p className="font-num text-2xl font-bold text-[#1A4A85] mt-0.5 print:text-xl">{formatarValor(dadosProjetos.totalLucroRealizado)}</p>
              <span className="text-[11px] font-semibold text-emerald-700">Margem Média: {formatarPercentual(dadosProjetos.margemMediaRealizada)}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden print:shadow-none print:border print:border-slate-300 print:rounded-none">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-serif font-bold text-lg text-[#003064]">Demonstrativo de Lucratividade por Obra Fotovoltaica</h3>
              <p className="text-xs text-slate-500">Valores apurados com base no valor contratado e notas/lançamentos vinculados de cada instalação.</p>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-xs text-slate-600 print:text-[8.5pt] [&_th]:print:border [&_th]:print:border-slate-300 [&_td]:print:border [&_td]:print:border-slate-300">
                <thead className="bg-[#F5F7FA] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 print:px-1.5">Projeto & Cliente</th>
                    <th className="py-3 px-4 print:px-1.5">Status</th>
                    <th className="py-3 px-4 text-right print:px-1.5">Contratado</th>
                    <th className="py-3 px-4 text-right print:px-1.5">Recebido</th>
                    <th className="py-3 px-4 text-right print:px-1.5">A Receber</th>
                    <th className="py-3 px-4 text-right print:px-1.5">Custos Obra</th>
                    <th className="py-3 px-4 text-right print:px-1.5">Lucro Realizado</th>
                    <th className="py-3 px-4 text-right print:px-1.5">Margem (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dadosProjetos.fichas.map((f) => (
                    <tr key={f.projeto.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 print:px-1.5">
                        <strong className="text-slate-800 block text-xs">{f.projeto.nome}</strong>
                        <span className="text-[11px] text-slate-400">{f.projeto.cliente}</span>
                      </td>
                      <td className="py-3 px-4 print:px-1.5">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          f.projeto.status === 'concluido' ? 'bg-emerald-100 text-emerald-800' : 'bg-[#FFF4CC] text-[#003064]'
                        }`}>
                          {f.projeto.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-num font-bold text-slate-800 print:px-1.5">{formatarValor(f.valorContratado)}</td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-medium print:px-1.5">{formatarValor(f.receitasPagas)}</td>
                      <td className="py-3 px-4 text-right text-slate-500 print:px-1.5">{formatarValor(f.receitaAReceber)}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-medium print:px-1.5">{formatarValor(f.custosRealizados)}</td>
                      <td className={`py-3 px-4 text-right font-num font-bold ${f.lucroRealizado >= 0 ? 'text-emerald-700' : 'text-red-600'} print:px-1.5`}>
                        {formatarValor(f.lucroRealizado)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-800 print:px-1.5">{formatarPercentual(f.margemRealizada)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. QUEM MAIS NOS DEVE E A QUEM DEVEMOS (COM INADIMPLÊNCIA) */}
      {relatorioAtivo === 'inadimplencia_contatos' && (
        <div className="space-y-6">
          {/* A5: aviso de que este relatório não depende do período */}
          <p className="text-xs text-slate-400 font-medium">
            Posição atual — não depende do período selecionado
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-red-200 bg-red-50/20 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[11px] font-bold uppercase text-red-600 block">Total Vencido a Receber (Inadimplência)</span>
              <p className="font-num text-2xl font-bold text-red-700 mt-1 print:text-xl">{formatarValor(dadosInadimplencia.totalInadimplenciaReceber)}</p>
              <span className="text-xs text-slate-500">Clientes com parcelas em atraso na MT Solar</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[11px] font-bold uppercase text-amber-700 block">Total Vencido a Pagar (Atrasos da Empresa)</span>
              <p className="font-num text-2xl font-bold text-amber-800 mt-1 print:text-xl">{formatarValor(dadosInadimplencia.totalVencidoPagar)}</p>
              <span className="text-xs text-slate-500">Boletos e duplicatas vencidas com fornecedores</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quem mais nos deve */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <h3 className="font-serif font-bold text-base text-[#003064] mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Quem Mais Nos Deve (Clientes)</span>
                <span className="text-xs text-red-600 font-bold">{dadosInadimplencia.quemNosDeve.length} devedores</span>
              </h3>
              <div className="space-y-3">
                {dadosInadimplencia.quemNosDeve.map((d, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                    <div>
                      <strong className="text-slate-800 block text-xs">{d.nome}</strong>
                      <span className="text-[11px] text-slate-400">{d.cpfCnpj}</span>
                      {d.totalVencido > 0 && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 block mt-1 w-fit">
                          {d.diasMaiorAtraso} dias de atraso ({d.parcelasVencidas} parcela(s))
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Total a Receber:</span>
                      <span className="font-num font-bold text-sm text-[#003064] block">{formatarValor(d.totalDevido)}</span>
                      {d.totalVencido > 0 && (
                        <span className="text-[11px] font-bold text-red-600 block">Vencido: {formatarValor(d.totalVencido)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* A quem mais devemos */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <h3 className="font-serif font-bold text-base text-[#003064] mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>A Quem Mais Devemos (Fornecedores)</span>
                <span className="text-xs text-amber-700 font-bold">{dadosInadimplencia.aQuemDevemos.length} credores</span>
              </h3>
              <div className="space-y-3">
                {dadosInadimplencia.aQuemDevemos.map((c, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                    <div>
                      <strong className="text-slate-800 block text-xs">{c.nome}</strong>
                      <span className="text-[11px] text-slate-400">{c.cpfCnpj}</span>
                      <span className="text-[10px] text-slate-500 block mt-1">{c.parcelasPendentes} títulos pendentes</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Total a Pagar:</span>
                      <span className="font-num font-bold text-sm text-red-600 block">{formatarValor(c.totalDevido)}</span>
                      {c.totalVencido > 0 && (
                        <span className="text-[11px] font-bold text-red-700 block">Vencido: {formatarValor(c.totalVencido)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. USO DO CHEQUE ESPECIAL NO PERÍODO */}
      {relatorioAtivo === 'cheque_especial' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Dias no Negativo (Período)</span>
              <p className="font-num text-2xl font-bold text-red-600 mt-1 print:text-xl">{dadosCheque.diasNoNegativo} dias</p>
              <span className="text-xs text-slate-500">Dias com saldo real abaixo de zero</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Maior Pico de Utilização</span>
              <p className="font-num text-2xl font-bold text-[#003064] mt-1 print:text-xl">{formatarValor(dadosCheque.maiorValorUtilizado)}</p>
              <span className="text-xs text-slate-500">Pico máximo atingido no limite</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Custo Estimado de Juros</span>
              <p className="font-num text-2xl font-bold text-amber-700 mt-1 print:text-xl">{formatarValor(dadosCheque.custoTotalJurosEstimado)}</p>
              <span className="text-xs text-slate-500">Estimativa baseada na taxa cadastrada</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden print:shadow-none print:border print:border-slate-300 print:rounded-none">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-serif font-bold text-lg text-[#003064]">Detalhamento por Conta Bancária MT Solar</h3>
              <p className="text-xs text-slate-500">Acompanhamento da exposição financeira em cada instituição bancária.</p>
            </div>

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-xs text-slate-600 print:text-[8.5pt] [&_th]:print:border [&_th]:print:border-slate-300 [&_td]:print:border [&_td]:print:border-slate-300">
                <thead className="bg-[#F5F7FA] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 print:px-1.5">Conta Bancária</th>
                    <th className="py-3 px-4 text-right print:px-1.5">Saldo Real Atual</th>
                    <th className="py-3 px-4 text-right print:px-1.5">Limite Contratado</th>
                    <th className="py-3 px-4 text-right print:px-1.5">Cheque Usado Hoje</th>
                    <th className="py-3 px-4 text-center print:px-1.5">Dias Negativo</th>
                    <th className="py-3 px-4 text-right print:px-1.5">Pico de Uso</th>
                    <th className="py-3 px-4 text-right print:px-1.5">Juros Estimados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dadosCheque.detalhesPorConta.map((c) => (
                    <tr key={c.conta.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800 print:px-1.5">{c.conta.nome}</td>
                      <td className={`py-3 px-4 text-right font-num font-bold ${c.saldoAtual >= 0 ? 'text-emerald-700' : 'text-red-600'} print:px-1.5`}>
                        {formatarValor(c.saldoAtual)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 print:px-1.5">{formatarValor(c.limite)}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-semibold print:px-1.5">{formatarValor(c.chequeUsadoAtual)}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800 print:px-1.5">{c.diasNegativo}</td>
                      <td className="py-3 px-4 text-right text-red-700 font-medium print:px-1.5">{formatarValor(c.picoUso)}</td>
                      <td className="py-3 px-4 text-right text-amber-700 font-bold print:px-1.5">{formatarValor(c.jurosEstimados)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. FUNCIONÁRIOS: CUSTO POR FUNCIONÁRIO E SETOR */}
      {relatorioAtivo === 'funcionarios_folha' && (
        <div className="space-y-6">
          <p className="text-xs text-slate-500">
            Custo por colaborador e por setor = custo mensal estimado atual (não depende do período). A tabela abaixo mostra a folha do período selecionado.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Total de Colaboradores</span>
              <p className="font-num text-2xl font-bold text-[#003064] mt-1 print:text-xl">{dadosFuncionarios.porFuncionario.length}</p>
              <span className="text-xs text-slate-500">Equipe técnica e administrativa</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Custo Mensal Global Empresa</span>
              <p className="font-num text-2xl font-bold text-red-600 mt-1 print:text-xl">{formatarValor(dadosFuncionarios.totalGeralMensalEmpresa)}</p>
              <span className="text-xs text-slate-500">Salários + Benefícios + Encargos</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Setor com Maior Custo</span>
              <p className="font-serif text-xl font-bold text-[#1A4A85] mt-1">{dadosFuncionarios.porSetor[0]?.setor || 'Instalação'}</p>
              <span className="text-xs text-slate-500">{formatarValor(dadosFuncionarios.porSetor[0]?.totalCusto || 0)} / mês</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Custo por Colaborador */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <h3 className="font-serif font-bold text-base text-[#003064] mb-3 pb-2 border-b border-slate-100">
                Custo Total por Funcionário (com Encargos)
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1 print:max-h-none print:overflow-visible">
                {dadosFuncionarios.porFuncionario.map((item) => (
                  <div key={item.funcionario.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                    <div>
                      <strong className="text-slate-800 block text-xs">{item.funcionario.nome}</strong>
                      <span className="text-[11px] text-slate-500">{item.funcionario.cargo} ({item.funcionario.tipo_contrato})</span>
                      <span className="text-[10px] text-slate-400 block">Base: {formatarValor(item.salarioBase)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Custo Total Empresa:</span>
                      <span className="font-num font-bold text-sm text-red-600">{formatarValor(item.custoTotalMensal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custo por Setor */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none">
              <h3 className="font-serif font-bold text-base text-[#003064] mb-3 pb-2 border-b border-slate-100">
                Distribuição de Custos por Setor
              </h3>
              <div className="space-y-3">
                {dadosFuncionarios.porSetor.map((s) => (
                  <div key={s.setor} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                    <div>
                      <strong className="text-slate-800 block text-xs">{s.setor}</strong>
                      <span className="text-[11px] text-slate-500">{s.qtd} colaborador(es)</span>
                    </div>
                    <div className="text-right">
                      <span className="font-num font-bold text-sm text-[#003064] block">{formatarValor(s.totalCusto)}</span>
                      <span className="text-[10px] text-slate-400">Salários Base: {formatarValor(s.totalBase)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Folha de Pagamento no Período */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 print:shadow-none print:border print:border-slate-300 print:rounded-none">
            <h3 className="font-serif font-bold text-base text-[#003064] mb-3 pb-2 border-b border-slate-100">
              Folha de Pagamento no Período
            </h3>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left text-xs text-slate-600 print:text-[10pt] [&_th]:print:border [&_th]:print:border-slate-300 [&_td]:print:border [&_td]:print:border-slate-300">
                <thead className="bg-[#F5F7FA] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Competência</th>
                    <th className="py-3 px-4 text-right">Já Pago</th>
                    <th className="py-3 px-4 text-right">Total do Mês</th>
                    <th className="py-3 px-4 text-right">Lançamentos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dadosFuncionarios.folhaMensalAno.map((m) => {
                    const temLanc = m.quantidadeLancamentos > 0;
                    return (
                      <tr key={m.competencia} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-800">{m.rotulo}</td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-700">
                          {temLanc ? formatarValor(m.totalPago) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-num font-bold text-[#003064]">
                          {temLanc ? formatarValor(m.totalLiquido) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">
                          {temLanc ? m.quantidadeLancamentos : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {dadosFuncionarios.folhaMensalAno.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                        Nenhum lançamento no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F5F7FA] font-bold border-t border-slate-300 text-slate-800">
                    <td className="py-3 px-4 font-bold">TOTAIS</td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-700">
                      {formatarValor(dadosFuncionarios.folhaMensalAno.reduce((acc, m) => acc + m.totalPago, 0))}
                    </td>
                    <td className="py-3 px-4 text-right font-num font-bold text-[#003064]">
                      {formatarValor(dadosFuncionarios.folhaMensalAno.reduce((acc, m) => acc + m.totalLiquido, 0))}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">
                      {dadosFuncionarios.folhaMensalAno.reduce((acc, m) => acc + m.quantidadeLancamentos, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. COMPARATIVO MÊS A MÊS */}
      {relatorioAtivo === 'comparativo_mensal' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 print:shadow-none print:border print:border-slate-300 print:rounded-none">
            <h3 className="font-serif font-bold text-lg text-[#003064] mb-1">
              Comparativo Evolutivo Mensal – Ano {dadosComparativo.ano}
            </h3>
            <p className="text-xs text-slate-500 mb-6">Oscilação percentual e crescimento nominal mês a mês.</p>

            <div className="overflow-x-auto print:overflow-visible print-avoid-break">
              <table className="w-full text-left text-xs text-slate-600 print:table-fixed print:text-[8.5pt] [&_th]:print:border [&_th]:print:border-slate-300 [&_td]:print:border [&_td]:print:border-slate-300">
                <thead className="bg-[#F5F7FA] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 print:px-1.5 print:py-1 print:whitespace-normal">Mês</th>
                    <th className="py-3 px-4 text-right print:px-1.5 print:py-1 print:whitespace-normal">Receitas</th>
                    <th className="py-3 px-4 text-right print:px-1.5 print:py-1 print:whitespace-normal">Variação Rec. (%)</th>
                    <th className="py-3 px-4 text-right print:px-1.5 print:py-1 print:whitespace-normal">Despesas</th>
                    <th className="py-3 px-4 text-right print:px-1.5 print:py-1 print:whitespace-normal">Variação Desp. (%)</th>
                    <th className="py-3 px-4 text-right print:px-1.5 print:py-1 print:whitespace-normal">Resultado Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dadosComparativo.meses.map((m) => (
                    <tr key={m.rotulo} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800 print:px-1.5 print:py-1">{m.rotulo}</td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-700 print:px-1.5 print:py-1">{formatarValor(m.realizadoEntradas)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${m.variacaoReceitas >= 0 ? 'text-emerald-700' : 'text-red-600'} print:px-1.5 print:py-1`}>
                        {m.variacaoReceitas > 0 ? `+${formatarPercentual(m.variacaoReceitas)}` : formatarPercentual(m.variacaoReceitas)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-red-600 print:px-1.5 print:py-1">{formatarValor(m.realizadoSaidas)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${m.variacaoDespesas <= 0 ? 'text-emerald-700' : 'text-amber-700'} print:px-1.5 print:py-1`}>
                        {m.variacaoDespesas > 0 ? `+${formatarPercentual(m.variacaoDespesas)}` : formatarPercentual(m.variacaoDespesas)}
                      </td>
                      <td className={`py-3 px-4 text-right font-num font-bold ${m.realizadoLiquido >= 0 ? 'text-[#003064]' : 'text-red-600'} print:px-1.5 print:py-1`}>
                        {formatarValor(m.realizadoLiquido)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* G3: 9. BALANÇO PATRIMONIAL GERENCIAL */}
      {relatorioAtivo === 'balanco_patrimonial' && (
        <div className="space-y-6">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs print:shadow-none print:p-0 print:border-0">
            {/* Topo do relatório */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500">
                    Posição atual — não depende do período selecionado
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500">
                    Posição em {formatarDataBR(dadosBalanco.dataBase)}
                  </span>
                </div>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={abrirModalAjustes}
                  className="print:hidden inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-[#003064] transition-colors cursor-pointer w-fit"
                >
                  <Plus className="w-4 h-4 text-[#003064]" />
                  <span>Ajustes manuais</span>
                </button>
              )}
            </div>

            {/* Aviso âmbar */}
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2.5 print:mt-2 print:p-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Balanço gerencial. Imobilizado, capital social, financiamentos e demais itens são informados manualmente em Ajustes manuais. Não substitui o balanço contábil elaborado pelo contador.
              </p>
            </div>

            {/* Duas colunas do Balanço */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 print:grid-cols-2 gap-6 items-start print:gap-3 print:mt-3">
              {/* COLUNA ESQUERDA: ATIVO */}
              <div className="border border-slate-200 rounded-xl overflow-hidden print-avoid-break">
                <div className="bg-[#003064] text-white px-4 py-2.5 font-serif font-bold text-sm tracking-wide">
                  ATIVO
                </div>

                <div className="p-4 space-y-5 text-xs print:p-2 print:space-y-3 print:text-[9pt]">
                  {/* Circulante */}
                  <div>
                    <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-2 uppercase text-[11px] tracking-wider text-slate-500">
                      Circulante
                    </div>
                    {dadosBalanco.ativoCirculante.length === 0 ? (
                      <p className="text-slate-400 italic py-1">—</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dadosBalanco.ativoCirculante.map((linha, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-700 flex items-center gap-1.5">
                              {linha.nome}
                              {linha.origem === 'manual' && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  manual
                                </span>
                              )}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {formatarValor(linha.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200 font-bold text-slate-800">
                      <span>Total do Ativo Circulante</span>
                      <span className="text-emerald-700 font-num">
                        {formatarValor(dadosBalanco.totais.ativoCirculante)}
                      </span>
                    </div>
                  </div>

                  {/* Não circulante */}
                  <div className="pt-2">
                    <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-2 uppercase text-[11px] tracking-wider text-slate-500">
                      Não circulante
                    </div>
                    {dadosBalanco.ativoNaoCirculante.length === 0 ? (
                      <p className="text-slate-400 italic py-1">—</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dadosBalanco.ativoNaoCirculante.map((linha, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-700 flex items-center gap-1.5">
                              {linha.nome}
                              {linha.origem === 'manual' && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  manual
                                </span>
                              )}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {formatarValor(linha.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200 font-bold text-slate-800">
                      <span>Total do Ativo Não Circulante</span>
                      <span className="text-emerald-700 font-num">
                        {formatarValor(dadosBalanco.totais.ativoNaoCirculante)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-100 px-4 py-3 border-t border-slate-200 flex items-center justify-between font-serif font-bold text-sm text-[#003064]">
                  <span>TOTAL DO ATIVO</span>
                  <span className="text-base text-emerald-700 font-num">
                    {formatarValor(dadosBalanco.totais.ativo)}
                  </span>
                </div>
              </div>

              {/* COLUNA DIREITA: PASSIVO E PATRIMÔNIO LÍQUIDO */}
              <div className="border border-slate-200 rounded-xl overflow-hidden print-avoid-break">
                <div className="bg-[#003064] text-white px-4 py-2.5 font-serif font-bold text-sm tracking-wide">
                  PASSIVO E PATRIMÔNIO LÍQUIDO
                </div>

                <div className="p-4 space-y-5 text-xs print:p-2 print:space-y-3 print:text-[9pt]">
                  {/* Passivo circulante */}
                  <div>
                    <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-2 uppercase text-[11px] tracking-wider text-slate-500">
                      Passivo circulante
                    </div>
                    {dadosBalanco.passivoCirculante.length === 0 ? (
                      <p className="text-slate-400 italic py-1">—</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dadosBalanco.passivoCirculante.map((linha, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-700 flex items-center gap-1.5">
                              {linha.nome}
                              {linha.origem === 'manual' && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  manual
                                </span>
                              )}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {formatarValor(linha.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200 font-bold text-slate-800">
                      <span>Total do Passivo Circulante</span>
                      <span className="text-red-700 font-num">
                        {formatarValor(dadosBalanco.totais.passivoCirculante)}
                      </span>
                    </div>
                  </div>

                  {/* Passivo não circulante */}
                  <div className="pt-2">
                    <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-2 uppercase text-[11px] tracking-wider text-slate-500">
                      Passivo não circulante
                    </div>
                    {dadosBalanco.passivoNaoCirculante.length === 0 ? (
                      <p className="text-slate-400 italic py-1">—</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dadosBalanco.passivoNaoCirculante.map((linha, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-700 flex items-center gap-1.5">
                              {linha.nome}
                              {linha.origem === 'manual' && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  manual
                                </span>
                              )}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {formatarValor(linha.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200 font-bold text-slate-800">
                      <span>Total do Passivo Não Circulante</span>
                      <span className="text-red-700 font-num">
                        {formatarValor(dadosBalanco.totais.passivoNaoCirculante)}
                      </span>
                    </div>
                  </div>

                  {/* Patrimônio líquido */}
                  <div className="pt-2">
                    <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-2 uppercase text-[11px] tracking-wider text-slate-500">
                      Patrimônio líquido
                    </div>
                    {dadosBalanco.patrimonioLiquido.length === 0 ? (
                      <p className="text-slate-400 italic py-1">—</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dadosBalanco.patrimonioLiquido.map((linha, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-700 flex items-center gap-1.5">
                              {linha.nome}
                              {linha.origem === 'manual' && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  manual
                                </span>
                              )}
                            </span>
                            <span className={`font-semibold ${linha.valor < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                              {formatarValor(linha.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200 font-bold text-slate-800">
                      <span>Total do Patrimônio Líquido</span>
                      <span className="text-[#003064] font-num">
                        {formatarValor(dadosBalanco.totais.patrimonioLiquido)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-100 px-4 py-3 border-t border-slate-200 flex items-center justify-between font-serif font-bold text-sm text-[#003064]">
                  <span>TOTAL DO PASSIVO + PATRIMÔNIO LÍQUIDO</span>
                  <span className="text-base text-[#003064] font-num">
                    {formatarValor(dadosBalanco.totais.passivoMaisPL)}
                  </span>
                </div>
              </div>
            </div>

            {/* Rodapé do relatório: Conferência */}
            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs print:mt-3 print:pt-2">
              <div className="flex items-center gap-2">
                {Math.abs(dadosBalanco.totais.ativo - dadosBalanco.totais.passivoMaisPL) < 0.01 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-semibold text-emerald-700">
                      Conferência: Ativo = Passivo + PL
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="font-semibold text-red-700">
                      Atenção: Ativo difere de Passivo + PL
                    </span>
                  </>
                )}
              </div>
              <div className="text-slate-400 text-[11px]">
                Ativo: {formatarValor(dadosBalanco.totais.ativo)} | Passivo + PL: {formatarValor(dadosBalanco.totais.passivoMaisPL)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* G4: MODAL DE AJUSTES MANUAIS DO BALANÇO */}
      <Modal
        isOpen={modalAjustesAberto}
        onClose={() => setModalAjustesAberto(false)}
        title="Ajustes Manuais do Balanço Patrimonial"
        subtitle="Gerencie bens, obrigações e capital informados manualmente"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
            <strong>Exemplos:</strong> Estoque, Veículos e equipamentos (ativo não circulante), Impostos a recolher e Provisão de férias e 13º (passivo circulante), Financiamentos (passivo não circulante), Capital social.
          </p>

          {erroAjustes && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{erroAjustes}</span>
            </div>
          )}

          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1 print:max-h-none print:overflow-visible">
            {itensAjuste.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Nenhum item manual cadastrado. Clique em "+ Adicionar item" para incluir.
              </p>
            ) : (
              itensAjuste.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <select
                    value={item.grupo}
                    onChange={(e) => {
                      const novoGrupo = e.target.value as GrupoManualBalanco;
                      setItensAjuste((prev) =>
                        prev.map((it, i) => (i === index ? { ...it, grupo: novoGrupo } : it))
                      );
                    }}
                    className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#003064]"
                  >
                    <option value="ativo_circulante">Ativo circulante</option>
                    <option value="ativo_nao_circulante">Ativo não circulante</option>
                    <option value="passivo_circulante">Passivo circulante</option>
                    <option value="passivo_nao_circulante">Passivo não circulante</option>
                    <option value="pl_capital">Capital social</option>
                    <option value="pl_reservas">Reservas</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Nome do item (ex: Veículos)"
                    value={item.nome}
                    onChange={(e) => {
                      const novoNome = e.target.value;
                      setItensAjuste((prev) =>
                        prev.map((it, i) => (i === index ? { ...it, nome: novoNome } : it))
                      );
                    }}
                    className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 flex-1 focus:outline-none focus:ring-1 focus:ring-[#003064]"
                  />

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Valor"
                      value={item.valor || ''}
                      onChange={(e) => {
                        const novoValor = parseFloat(e.target.value) || 0;
                        setItensAjuste((prev) =>
                          prev.map((it, i) => (i === index ? { ...it, valor: novoValor } : it))
                        );
                      }}
                      className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 w-28 focus:outline-none focus:ring-1 focus:ring-[#003064]"
                    />

                    <button
                      type="button"
                      onClick={() => setItensAjuste((prev) => prev.filter((_, i) => i !== index))}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Remover item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={() =>
                setItensAjuste((prev) => [
                  ...prev,
                  { id: '', grupo: 'ativo_circulante', nome: '', valor: 0 },
                ])
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#003064] bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar item</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalAjustesAberto(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarAjustes}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#003064] hover:bg-[#00204A] rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Salvar Ajustes
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* RODAPÉ DE IMPRESSÃO (APARECE APENAS NO PRINT / PDF) */}
      <div className="hidden print:block fixed bottom-0 left-0 right-0 text-center text-[9px] text-slate-400">
        MT Solar — Relatório gerado pelo sistema de Gestão Financeira
      </div>

    </div>
  );
};

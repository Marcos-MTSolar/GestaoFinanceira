import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dbService, subscribe } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { usePrivacy } from '../context/PrivacyContext';
import { formatarMoeda, formatarDataBR, formatarCpfCnpj } from '../utils/formatters';
import { exportarTabelaGenericaCSV } from '../utils/csvExporter';
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
  FileText
} from 'lucide-react';

type TipoRelatorio =
  | 'dre'
  | 'fluxo_caixa'
  | 'categorias'
  | 'lucratividade_projetos'
  | 'inadimplencia_contatos'
  | 'cheque_especial'
  | 'funcionarios_folha'
  | 'comparativo_mensal';

export const Relatorios: React.FC = () => {
  const { usuario } = useAuth();
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

  // Trigger para reatividade
  const [versaoDados, setVersaoDados] = useState(0);

  useEffect(() => {
    const unsubL = subscribe('lancamentos', () => setVersaoDados(v => v + 1));
    const unsubF = subscribe('funcionarios', () => setVersaoDados(v => v + 1));
    const unsubP = subscribe('projetos', () => setVersaoDados(v => v + 1));
    const unsubC = subscribe('contas', () => setVersaoDados(v => v + 1));
    return () => {
      unsubL();
      unsubF();
      unsubP();
      unsubC();
    };
  }, []);

  // Atualizar datas quando preset muda
  const handleMudarPreset = (preset: 'ano_atual' | 'mes_atual' | 'ultimos_12' | 'personalizado') => {
    setPeriodoPreset(preset);
    if (preset === 'ano_atual') {
      setDataInicio(`${anoAtual}-01-01`);
      setDataFim(`${anoAtual}-12-31`);
      setAnoSelecionado(anoAtual);
    } else if (preset === 'mes_atual') {
      setDataInicio(`${anoAtual}-${mesAtual}-01`);
      const ultimoDia = new Date(anoAtual, parseInt(mesAtual, 10), 0).getDate();
      setDataFim(`${anoAtual}-${mesAtual}-${String(ultimoDia).padStart(2, '0')}`);
      setAnoSelecionado(anoAtual);
    } else if (preset === 'ultimos_12') {
      const d12 = new Date();
      d12.setFullYear(d12.getFullYear() - 1);
      setDataInicio(d12.toISOString().split('T')[0]);
      setDataFim(hoje.toISOString().split('T')[0]);
    }
  };

  // Carregar dados conforme o relatório
  const dadosDRE = useMemo(() => {
    return dbService.gerarRelatorioDRE(dataInicio, dataFim);
  }, [dataInicio, dataFim, versaoDados]);

  const dadosFluxo = useMemo(() => {
    return dbService.gerarRelatorioFluxoCaixa(anoSelecionado);
  }, [anoSelecionado, versaoDados]);

  const dadosCategorias = useMemo(() => {
    const todos = dbService.getLancamentos().filter(
      l => l.status === 'pago' && l.origem !== 'transferencia'
    );
    const categorias = dbService.getCategorias();

    const filtrados = todos.filter(l => {
      const dt = l.data_pagamento || l.data_vencimento;
      return dt >= dataInicio && dt <= dataFim;
    });

    const receitasMap = new Map<string, number>();
    const despesasMap = new Map<string, number>();
    let totalRec = 0;
    let totalDes = 0;

    filtrados.forEach(l => {
      if (l.tipo === 'receita') {
        receitasMap.set(l.categoria_id, (receitasMap.get(l.categoria_id) || 0) + l.valor);
        totalRec += l.valor;
      } else {
        despesasMap.set(l.categoria_id, (despesasMap.get(l.categoria_id) || 0) + l.valor);
        totalDes += l.valor;
      }
    });

    const listaReceitas = Array.from(receitasMap.entries()).map(([id, val]) => {
      const c = categorias.find(cat => cat.id === id);
      return {
        id,
        nome: c ? c.nome : 'Outras Receitas',
        cor: c?.cor || '#16A34A',
        valor: val,
        percentual: totalRec > 0 ? +((val / totalRec) * 100).toFixed(1) : 0,
      };
    }).sort((a, b) => b.valor - a.valor);

    const listaDespesas = Array.from(despesasMap.entries()).map(([id, val]) => {
      const c = categorias.find(cat => cat.id === id);
      return {
        id,
        nome: c ? c.nome : 'Outras Despesas',
        cor: c?.cor || '#DC2626',
        valor: val,
        percentual: totalDes > 0 ? +((val / totalDes) * 100).toFixed(1) : 0,
      };
    }).sort((a, b) => b.valor - a.valor);

    return {
      totalRec,
      totalDes,
      listaReceitas,
      listaDespesas,
    };
  }, [dataInicio, dataFim, versaoDados]);

  const dadosProjetos = useMemo(() => {
    return dbService.gerarRelatorioLucratividadeProjetos();
  }, [versaoDados]);

  const dadosInadimplencia = useMemo(() => {
    return dbService.gerarRelatorioInadimplenciaContatos();
  }, [versaoDados]);

  const dadosCheque = useMemo(() => {
    return dbService.gerarRelatorioChequeEspecial(dataInicio, dataFim);
  }, [dataInicio, dataFim, versaoDados]);

  const dadosFuncionarios = useMemo(() => {
    return dbService.gerarRelatorioFuncionariosFolha(anoSelecionado);
  }, [anoSelecionado, versaoDados]);

  const dadosComparativo = useMemo(() => {
    return dbService.gerarRelatorioComparativoMesAMes(anoSelecionado);
  }, [anoSelecionado, versaoDados]);

  // Função de Impressão
  const handleImprimir = () => {
    window.print();
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
            <p className="text-xs text-slate-500 mt-1 font-semibold">
              MT Solar – Energia Renovável | Gestão Financeira Empresarial
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-serif font-bold text-base text-[#003064]">
              {TITULOS_RELATORIOS[relatorioAtivo].titulo}
            </p>
            <p className="text-[11px] text-slate-500">
              Período: {formatarDataBR(dataInicio)} até {formatarDataBR(dataFim)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')} por {usuario?.nome || 'Administrador'}
            </p>
          </div>
        </div>
      </div>

      {/* SELEÇÃO DO TIPO DE RELATÓRIO (8 RELATÓRIOS OFICIAIS) */}
      <div className="print:hidden bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-[800px]">
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
      <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
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
              onClick={() => setPeriodoPreset('personalizado')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                periodoPreset === 'personalizado' ? 'bg-white text-[#003064] shadow-xs' : 'text-slate-600'
              }`}
            >
              Personalizado
            </button>
          </div>
        </div>

        {periodoPreset === 'personalizado' ? (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 bg-white"
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 bg-white"
            />
          </div>
        ) : (
          <div className="text-xs text-slate-500 font-medium">
            Filtrando de <strong>{formatarDataBR(dataInicio)}</strong> até <strong>{formatarDataBR(dataFim)}</strong>
          </div>
        )}
      </div>

      {/* CONTEÚDO ESPECÍFICO DE CADA RELATÓRIO */}

      {/* 1. DRE SIMPLIFICADO */}
      {relatorioAtivo === 'dre' && (
        <div className="space-y-6">
          {/* Cards Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Receita Bruta Realizada</span>
              <p className="font-serif text-2xl font-bold text-emerald-600 mt-1">
                {formatarValor(dadosDRE.receitaTotal)}
              </p>
              <span className="text-[11px] text-slate-400">Total faturado no período</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Custos e Despesas Totais</span>
              <p className="font-serif text-2xl font-bold text-red-600 mt-1">
                {formatarValor(dadosDRE.despesaTotal)}
              </p>
              <span className="text-[11px] text-slate-400">Operacional, insumos e equipes</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Resultado Líquido do Exercício</span>
              <p className={`font-serif text-2xl font-bold mt-1 ${dadosDRE.resultadoLiquido >= 0 ? 'text-[#003064]' : 'text-red-600'}`}>
                {formatarValor(dadosDRE.resultadoLiquido)}
              </p>
              <span className="text-[11px] text-slate-400">Receitas (-) Despesas</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Margem Líquida</span>
              <p className="font-serif text-2xl font-bold text-[#FCBC00] mt-1">
                {dadosDRE.margemLiquida}%
              </p>
              <span className="text-[11px] text-slate-400">% líquida sobre a receita bruta</span>
            </div>
          </div>

          {/* Tabelas de DRE Detalhadas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Receitas */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <h3 className="font-serif font-bold text-base text-[#16A34A] mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Receitas por Categoria (+)</span>
                <span className="text-xs font-bold text-slate-500">{formatarValor(dadosDRE.receitaTotal)}</span>
              </h3>
              <div className="space-y-2">
                {dadosDRE.linhasReceitas.map((r) => (
                  <div key={r.categoriaId} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.cor }} />
                      <span className="font-semibold text-slate-800">{r.nome}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-serif font-bold text-emerald-700 block">{formatarValor(r.valor)}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{r.percentualReceita}% da receita</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Despesas */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <h3 className="font-serif font-bold text-base text-[#DC2626] mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Despesas por Categoria (-)</span>
                <span className="text-xs font-bold text-slate-500">{formatarValor(dadosDRE.despesaTotal)}</span>
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {dadosDRE.linhasDespesas.map((d) => (
                  <div key={d.categoriaId} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.cor }} />
                      <span className="font-semibold text-slate-800">{d.nome}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-serif font-bold text-red-600 block">{formatarValor(d.valor)}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{d.percentualReceita}% da receita</span>
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
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-[#003064]">
                  Fluxo de Caixa Mensal – Ano {dadosFluxo.ano}
                </h3>
                <p className="text-xs text-slate-500">
                  Comparativo entre o faturamento efetivamente pago no banco e o volume previsto por data de vencimento.
                </p>
              </div>
            </div>

            <div className="h-80 w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosFluxo.meses} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="mesNome" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatarValor(Number(v))} />
                  <Legend />
                  <Bar dataKey="realizadoEntradas" name="Realizado Entradas" fill="#003064" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="realizadoSaidas" name="Realizado Saídas" fill="#FCBC00" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previstoEntradas" name="Previsto Entradas" fill="#1A4A85" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previstoSaidas" name="Previsto Saídas" fill="#DC2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-[#F5F7FA] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Mês</th>
                    <th className="py-2.5 px-3 text-right">Realiz. Entradas</th>
                    <th className="py-2.5 px-3 text-right">Realiz. Saídas</th>
                    <th className="py-2.5 px-3 text-right">Resultado Caixa</th>
                    <th className="py-2.5 px-3 text-right">Prev. Entradas</th>
                    <th className="py-2.5 px-3 text-right">Prev. Saídas</th>
                    <th className="py-2.5 px-3 text-right">Resultado Previsto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dadosFluxo.meses.map((m) => (
                    <tr key={m.mesIndex} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-800">{m.rotulo}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-700">{formatarValor(m.realizadoEntradas)}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-red-600">{formatarValor(m.realizadoSaidas)}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${m.realizadoLiquido >= 0 ? 'text-[#003064]' : 'text-red-700'}`}>
                        {formatarValor(m.realizadoLiquido)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{formatarValor(m.previstoEntradas)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{formatarValor(m.previstoSaidas)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-700">{formatarValor(m.previstoLiquido)}</td>
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
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
              <h3 className="font-serif font-bold text-base text-[#003064] mb-1">
                Composição de Despesas por Centro de Custo
              </h3>
              <p className="text-xs text-slate-500 mb-4">Total: {formatarValor(dadosCategorias.totalDes)}</p>
              
              <div className="h-64 w-full">
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
                    >
                      {dadosCategorias.listaDespesas.map((d) => (
                        <Cell key={d.id} fill={d.cor} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatarValor(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 mt-4 max-h-56 overflow-y-auto pr-1">
                {dadosCategorias.listaDespesas.map((d) => (
                  <div key={d.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.cor }} />
                      <strong className="text-slate-800">{d.nome}</strong>
                    </span>
                    <span>{formatarValor(d.valor)} ({d.percentual}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico Rosca Receitas */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
              <h3 className="font-serif font-bold text-base text-[#003064] mb-1">
                Composição de Receitas da MT Solar
              </h3>
              <p className="text-xs text-slate-500 mb-4">Total: {formatarValor(dadosCategorias.totalRec)}</p>

              <div className="h-64 w-full">
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
                    >
                      {dadosCategorias.listaReceitas.map((r) => (
                        <Cell key={r.id} fill={r.cor} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatarValor(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 mt-4 max-h-56 overflow-y-auto pr-1">
                {dadosCategorias.listaReceitas.map((r) => (
                  <div key={r.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.cor }} />
                      <strong className="text-slate-800">{r.nome}</strong>
                    </span>
                    <span>{formatarValor(r.valor)} ({r.percentual}%)</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Contratado</span>
              <p className="font-serif text-2xl font-bold text-[#003064] mt-0.5">{formatarValor(dadosProjetos.totalContratado)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Faturado em Caixa</span>
              <p className="font-serif text-2xl font-bold text-emerald-600 mt-0.5">{formatarValor(dadosProjetos.totalRecebido)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Custos Obras Realizados</span>
              <p className="font-serif text-2xl font-bold text-red-600 mt-0.5">{formatarValor(dadosProjetos.totalCustosRealizados)}</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Lucro Realizado Global</span>
              <p className="font-serif text-2xl font-bold text-[#1A4A85] mt-0.5">{formatarValor(dadosProjetos.totalLucroRealizado)}</p>
              <span className="text-[11px] font-semibold text-emerald-700">Margem Média: {dadosProjetos.margemMediaRealizada}%</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-serif font-bold text-lg text-[#003064]">Demonstrativo de Lucratividade por Obra Fotovoltaica</h3>
              <p className="text-xs text-slate-500">Valores apurados com base no valor contratado e notas/lançamentos vinculados de cada instalação.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-[#F5F7FA] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Projeto & Cliente</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Contratado</th>
                    <th className="py-3 px-4 text-right">Recebido</th>
                    <th className="py-3 px-4 text-right">A Receber</th>
                    <th className="py-3 px-4 text-right">Custos Obra</th>
                    <th className="py-3 px-4 text-right">Lucro Realizado</th>
                    <th className="py-3 px-4 text-right">Margem (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dadosProjetos.fichas.map((f) => (
                    <tr key={f.projeto.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <strong className="text-slate-800 block text-xs">{f.projeto.nome}</strong>
                        <span className="text-[11px] text-slate-400">{f.projeto.cliente}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          f.projeto.status === 'concluido' ? 'bg-emerald-100 text-emerald-800' : 'bg-[#FFF4CC] text-[#003064]'
                        }`}>
                          {f.projeto.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-serif font-bold text-slate-800">{formatarValor(f.valorContratado)}</td>
                      <td className="py-3 px-4 text-right text-emerald-700 font-medium">{formatarValor(f.receitasPagas)}</td>
                      <td className="py-3 px-4 text-right text-slate-500">{formatarValor(f.receitaAReceber)}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-medium">{formatarValor(f.custosRealizados)}</td>
                      <td className={`py-3 px-4 text-right font-serif font-bold ${f.lucroRealizado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {formatarValor(f.lucroRealizado)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-800">{f.margemRealizada}%</td>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-red-200 bg-red-50/20 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-red-600 block">Total Vencido a Receber (Inadimplência)</span>
              <p className="font-serif text-2xl font-bold text-red-700 mt-1">{formatarValor(dadosInadimplencia.totalInadimplenciaReceber)}</p>
              <span className="text-xs text-slate-500">Clientes com parcelas em atraso na MT Solar</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-amber-700 block">Total Vencido a Pagar (Atrasos da Empresa)</span>
              <p className="font-serif text-2xl font-bold text-amber-800 mt-1">{formatarValor(dadosInadimplencia.totalVencidoPagar)}</p>
              <span className="text-xs text-slate-500">Boletos e duplicatas vencidas com fornecedores</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quem mais nos deve */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
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
                      <span className="font-serif font-bold text-sm text-[#003064] block">{formatarValor(d.totalDevido)}</span>
                      {d.totalVencido > 0 && (
                        <span className="text-[11px] font-bold text-red-600 block">Vencido: {formatarValor(d.totalVencido)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* A quem mais devemos */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
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
                      <span className="font-serif font-bold text-sm text-red-600 block">{formatarValor(c.totalDevido)}</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Dias no Negativo (Período)</span>
              <p className="font-serif text-2xl font-bold text-red-600 mt-1">{dadosCheque.diasNoNegativo} dias</p>
              <span className="text-xs text-slate-500">Dias com saldo real abaixo de zero</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Maior Pico de Utilização</span>
              <p className="font-serif text-2xl font-bold text-[#003064] mt-1">{formatarValor(dadosCheque.maiorValorUtilizado)}</p>
              <span className="text-xs text-slate-500">Pico máximo atingido no limite</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Custo Estimado de Juros</span>
              <p className="font-serif text-2xl font-bold text-amber-700 mt-1">{formatarValor(dadosCheque.custoTotalJurosEstimado)}</p>
              <span className="text-xs text-slate-500">Estimativa baseada na taxa cadastrada</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-serif font-bold text-lg text-[#003064]">Detalhamento por Conta Bancária MT Solar</h3>
              <p className="text-xs text-slate-500">Acompanhamento da exposição financeira em cada instituição bancária.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-[#F5F7FA] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Conta Bancária</th>
                    <th className="py-3 px-4 text-right">Saldo Real Atual</th>
                    <th className="py-3 px-4 text-right">Limite Contratado</th>
                    <th className="py-3 px-4 text-right">Cheque Usado Hoje</th>
                    <th className="py-3 px-4 text-center">Dias Negativo</th>
                    <th className="py-3 px-4 text-right">Pico de Uso</th>
                    <th className="py-3 px-4 text-right">Juros Estimados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dadosCheque.detalhesPorConta.map((c) => (
                    <tr key={c.conta.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800">{c.conta.nome}</td>
                      <td className={`py-3 px-4 text-right font-serif font-bold ${c.saldoAtual >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {formatarValor(c.saldoAtual)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700">{formatarValor(c.limite)}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-semibold">{formatarValor(c.chequeUsadoAtual)}</td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">{c.diasNegativo}</td>
                      <td className="py-3 px-4 text-right text-red-700 font-medium">{formatarValor(c.picoUso)}</td>
                      <td className="py-3 px-4 text-right text-amber-700 font-bold">{formatarValor(c.jurosEstimados)}</td>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Total de Colaboradores</span>
              <p className="font-serif text-2xl font-bold text-[#003064] mt-1">{dadosFuncionarios.porFuncionario.length}</p>
              <span className="text-xs text-slate-500">Equipe técnica e administrativa</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Custo Mensal Global Empresa</span>
              <p className="font-serif text-2xl font-bold text-red-600 mt-1">{formatarValor(dadosFuncionarios.totalGeralMensalEmpresa)}</p>
              <span className="text-xs text-slate-500">Salários + Benefícios + Encargos</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block">Setor com Maior Custo</span>
              <p className="font-serif text-xl font-bold text-[#1A4A85] mt-1">{dadosFuncionarios.porSetor[0]?.setor || 'Instalação'}</p>
              <span className="text-xs text-slate-500">{formatarValor(dadosFuncionarios.porSetor[0]?.totalCusto || 0)} / mês</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Custo por Colaborador */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
              <h3 className="font-serif font-bold text-base text-[#003064] mb-3 pb-2 border-b border-slate-100">
                Custo Total por Funcionário (com Encargos)
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {dadosFuncionarios.porFuncionario.map((item) => (
                  <div key={item.funcionario.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center text-xs">
                    <div>
                      <strong className="text-slate-800 block text-xs">{item.funcionario.nome}</strong>
                      <span className="text-[11px] text-slate-500">{item.funcionario.cargo} ({item.funcionario.tipo_contrato})</span>
                      <span className="text-[10px] text-slate-400 block">Base: {formatarValor(item.salarioBase)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Custo Total Empresa:</span>
                      <span className="font-serif font-bold text-sm text-red-600">{formatarValor(item.custoTotalMensal)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custo por Setor */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
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
                      <span className="font-serif font-bold text-sm text-[#003064] block">{formatarValor(s.totalCusto)}</span>
                      <span className="text-[10px] text-slate-400">Salários Base: {formatarValor(s.totalBase)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. COMPARATIVO MÊS A MÊS */}
      {relatorioAtivo === 'comparativo_mensal' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
            <h3 className="font-serif font-bold text-lg text-[#003064] mb-1">
              Comparativo Evolutivo Mensal – Ano {dadosComparativo.ano}
            </h3>
            <p className="text-xs text-slate-500 mb-6">Oscilação percentual e crescimento nominal mês a mês.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-[#F5F7FA] text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Mês</th>
                    <th className="py-3 px-4 text-right">Receitas</th>
                    <th className="py-3 px-4 text-right">Variação Rec. (%)</th>
                    <th className="py-3 px-4 text-right">Despesas</th>
                    <th className="py-3 px-4 text-right">Variação Desp. (%)</th>
                    <th className="py-3 px-4 text-right">Resultado Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dadosComparativo.meses.map((m) => (
                    <tr key={m.mesIndex} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800">{m.rotulo}</td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-700">{formatarValor(m.realizadoEntradas)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${m.variacaoReceitas >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {m.variacaoReceitas > 0 ? `+${m.variacaoReceitas}%` : `${m.variacaoReceitas}%`}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-red-600">{formatarValor(m.realizadoSaidas)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${m.variacaoDespesas <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {m.variacaoDespesas > 0 ? `+${m.variacaoDespesas}%` : `${m.variacaoDespesas}%`}
                      </td>
                      <td className={`py-3 px-4 text-right font-serif font-bold ${m.realizadoLiquido >= 0 ? 'text-[#003064]' : 'text-red-600'}`}>
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

    </div>
  );
};

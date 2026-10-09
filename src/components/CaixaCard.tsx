import React from 'react';
import { usePrivacy } from '../context/PrivacyContext';
import { ResumoSaldoConta, ContaBancaria } from '../types';
import {
  Wallet,
  AlertTriangle,
  ShieldAlert,
  Percent,
  Calendar,
  Landmark,
  ArrowRight,
  TrendingDown,
  Info,
  CheckCircle2
} from 'lucide-react';

interface CaixaCardProps {
  titulo: string;
  subtitulo?: string;
  resumo: {
    saldo_real: number;
    limite_cheque_total: number;
    cheque_especial_utilizado: number;
    cheque_especial_disponivel: number;
    saldo_disponivel_total: number;
    usando_cheque_especial: boolean;
    percentual_cheque_usado: number;
    alerta_critico_cheque: boolean;
    custo_juros_mensal_estimado: number;
    custo_juros_diario_estimado: number;
    taxa_mensal?: number;
  };
  conta?: ContaBancaria;
  isConsolidado?: boolean;
  onClickExtrato?: () => void;
  onTransferir?: () => void;
  onConciliar?: () => void;
  onEditar?: () => void;
  onToggleAtiva?: () => void;
  onExcluir?: () => void;
  podeEditar?: boolean;
}

export const CaixaCard: React.FC<CaixaCardProps> = ({
  titulo,
  subtitulo,
  resumo,
  conta,
  isConsolidado = false,
  onClickExtrato,
  onTransferir,
  onConciliar,
  onEditar,
  onToggleAtiva,
  onExcluir,
  podeEditar = true,
}) => {
  const { formatarValor } = usePrivacy();

  const {
    saldo_real,
    limite_cheque_total,
    cheque_especial_utilizado,
    cheque_especial_disponivel,
    saldo_disponivel_total,
    usando_cheque_especial,
    percentual_cheque_usado,
    alerta_critico_cheque,
    custo_juros_mensal_estimado,
    custo_juros_diario_estimado,
    taxa_mensal,
  } = resumo;

  // Cálculo da barra visual segmentada:
  // Mostra a proporção entre Dinheiro Real e Crédito do Cheque Especial Disponível
  // Se o saldo real for positivo: base = saldo_real + cheque_especial_disponivel
  // Se for negativo: todo o disponível no banco vem do cheque especial restante
  let pctDinheiroReal = 0;
  let pctChequeDisponivel = 0;

  if (saldo_disponivel_total > 0) {
    if (saldo_real > 0) {
      const somaTotal = saldo_real + cheque_especial_disponivel;
      pctDinheiroReal = Math.round((saldo_real / somaTotal) * 100);
      pctChequeDisponivel = 100 - pctDinheiroReal;
    } else {
      pctDinheiroReal = 0;
      pctChequeDisponivel = 100;
    }
  }

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isConsolidado
          ? 'bg-linear-to-b from-white via-white to-slate-50 border-[#003064]/20 shadow-md ring-1 ring-[#003064]/10'
          : usando_cheque_especial
          ? 'bg-white border-red-300 shadow-sm ring-1 ring-red-100'
          : 'bg-white border-slate-200/90 shadow-xs hover:shadow-sm'
      }`}
    >
      {/* CABEÇALHO DO BLOCO */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-2xs ${
              isConsolidado
                ? 'bg-[#003064] text-[#FCBC00]'
                : ''
            }`}
            style={!isConsolidado ? { backgroundColor: conta?.cor || '#003064' } : undefined}
          >
            {isConsolidado ? (
              <Wallet className="w-5 h-5 text-[#FCBC00]" />
            ) : (
              <Landmark className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-base text-[#003064]">
                {titulo}
              </h3>
              {isConsolidado && (
                <span className="text-[10px] uppercase font-bold bg-[#FFF4CC] text-[#003064] px-2 py-0.5 rounded-full border border-[#FCBC00]/40">
                  Consolidado Ativo
                </span>
              )}
              {conta && !conta.ativa && (
                <span className="text-[10px] uppercase font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                  Inativa
                </span>
              )}
            </div>
            {subtitulo && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>
            )}
          </div>
        </div>

        {/* Botões de Ações Rápidas do Cabeçalho */}
        <div className="flex items-center gap-2 flex-wrap">
          {onClickExtrato && (
            <button
              onClick={onClickExtrato}
              type="button"
              className="text-xs font-semibold text-[#003064] hover:bg-[#FFF4CC]/50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Extrato</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#1A4A85]" />
            </button>
          )}

          {podeEditar && onTransferir && (
            <button
              onClick={onTransferir}
              type="button"
              className="text-xs font-semibold text-slate-700 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              title="Transferência entre contas"
            >
              Transferir
            </button>
          )}

          {podeEditar && onConciliar && (
            <button
              onClick={onConciliar}
              type="button"
              className="text-xs font-semibold text-slate-700 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              title="Conciliar com saldo do banco"
            >
              Conciliar
            </button>
          )}
        </div>
      </div>

      {/* CORPO PRINCIPAL COM OS 5 ITENS DO BLOCO CAIXA */}
      <div className="p-5 sm:p-6 space-y-6">
        
        {/* ITEM 1: SALDO REAL EM DESTAQUE (Regra Central) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span>1. Saldo Real</span>
              <span className="text-[11px] font-normal text-slate-400 capitalize">
                (Dinheiro próprio da MT Solar, SEM cheque especial)
              </span>
            </span>

            {usando_cheque_especial ? (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Negativo (Cheque Especial em Uso)
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Positivo (Recursos Próprios)
              </span>
            )}
          </div>

          <div
            className={`font-serif text-3xl sm:text-4xl font-black tracking-tight ${
              saldo_real >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
            }`}
          >
            {formatarValor(saldo_real)}
          </div>
        </div>

        {/* LINHA EM DESTAQUE REQUISITADA:
            "Dinheiro real: R$ X  +  Cheque especial disponível: R$ Y  =  Disponível no banco: R$ Z"
        */}
        <div className="bg-[#F5F7FA] p-3.5 rounded-xl border border-slate-200/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs font-medium text-slate-700">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#003064] shrink-0" />
              <span>Dinheiro real:</span>
              <strong className={saldo_real >= 0 ? 'text-[#003064]' : 'text-red-600'}>
                {formatarValor(saldo_real)}
              </strong>
            </div>

            <span className="hidden md:inline font-bold text-slate-400">+</span>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FCBC00] shrink-0" />
              <span>Cheque especial disponível:</span>
              <strong className="text-amber-800">
                {formatarValor(cheque_especial_disponivel)}
              </strong>
            </div>

            <span className="hidden md:inline font-bold text-slate-400">=</span>

            <div className="flex items-center gap-1.5 pt-1 md:pt-0 border-t md:border-t-0 border-slate-200">
              <span className="font-bold text-slate-900">Disponível no banco:</span>
              <strong className="font-serif font-black text-sm text-[#003064]">
                {formatarValor(saldo_disponivel_total)}
              </strong>
            </div>
          </div>

          {/* BARRA VISUAL SEGMENTADA */}
          <div className="mt-3">
            <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden flex shadow-inner">
              {pctDinheiroReal > 0 && (
                <div
                  style={{ width: `${pctDinheiroReal}%` }}
                  className="bg-[#003064] h-full transition-all duration-500 relative group cursor-help"
                  title={`Dinheiro próprio: ${pctDinheiroReal}%`}
                />
              )}
              {pctChequeDisponivel > 0 && (
                <div
                  style={{ width: `${pctChequeDisponivel}%` }}
                  className="bg-[#FCBC00] h-full transition-all duration-500 relative group cursor-help"
                  title={`Cheque especial: ${pctChequeDisponivel}%`}
                />
              )}
            </div>
            
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1.5 font-medium">
              <span className="flex items-center gap-1 text-[#003064]">
                <span className="w-2 h-2 rounded-sm bg-[#003064]" />
                Dinheiro da Empresa ({pctDinheiroReal}%)
              </span>
              <span className="flex items-center gap-1 text-amber-800">
                <span className="w-2 h-2 rounded-sm bg-[#FCBC00]" />
                Crédito do Banco ({pctChequeDisponivel}%)
              </span>
            </div>
          </div>
        </div>

        {/* GRADE DOS DEMAIS ITENS: 2, 3, 4, 5 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          
          {/* 2. CHEQUE ESPECIAL - LIMITE TOTAL */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              2. Limite Total
            </span>
            <p className="font-serif font-bold text-sm text-slate-800 mt-0.5">
              {formatarValor(limite_cheque_total)}
            </p>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Contratado c/ banco
            </span>
          </div>

          {/* 3. CHEQUE ESPECIAL - UTILIZADO */}
          <div className={`p-3 rounded-xl border shadow-2xs ${
            cheque_especial_utilizado > 0
              ? 'bg-red-50/60 border-red-200'
              : 'bg-white border-slate-200'
          }`}>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              3. Cheque Utilizado
            </span>
            <p className={`font-serif font-bold text-sm mt-0.5 ${
              cheque_especial_utilizado > 0 ? 'text-red-600' : 'text-slate-700'
            }`}>
              {formatarValor(cheque_especial_utilizado)}
            </p>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              máx(0, −saldo real)
            </span>
          </div>

          {/* 4. CHEQUE ESPECIAL - DISPONÍVEL */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              4. Cheque Disponível
            </span>
            <p className="font-serif font-bold text-sm text-amber-700 mt-0.5">
              {formatarValor(cheque_especial_disponivel)}
            </p>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Limite − Utilizado
            </span>
          </div>

          {/* 5. SALDO DISPONÍVEL TOTAL */}
          <div className="p-3 bg-[#FFF4CC]/30 rounded-xl border border-[#FCBC00]/40 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-[#003064] block">
              5. Saldo no Banco
            </span>
            <p className="font-serif font-black text-sm text-[#003064] mt-0.5">
              {formatarValor(saldo_disponivel_total)}
            </p>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Saldo Real + Limite
            </span>
          </div>

        </div>

        {/* ALERTAS OBRIGATÓRIOS CONFORME REQUISITOS */}

        {/* ALERTA 1: FAIXA VERMELHA SE SALDO REAL < 0 */}
        {usando_cheque_especial && (
          <div className="p-4 rounded-xl bg-red-50 border-2 border-red-300 text-red-900 space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
              <p className="font-bold text-sm text-red-700">
                Você está usando {formatarValor(cheque_especial_utilizado)} do cheque especial
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white/70 p-2.5 rounded-lg border border-red-200">
              <div>
                <span className="text-slate-600 block text-[11px]">Estimativa de custo diário:</span>
                <strong className="text-red-700 font-serif">
                  {formatarValor(custo_juros_diario_estimado)} / dia
                </strong>
              </div>
              <div>
                <span className="text-slate-600 block text-[11px]">
                  Estimativa de custo mensal ({taxa_mensal ? `${taxa_mensal}% a.m.` : 'taxa mensal'}):
                </span>
                <strong className="text-red-700 font-serif">
                  {formatarValor(custo_juros_mensal_estimado)} / mês
                </strong>
              </div>
            </div>

            <p className="text-[10px] text-red-600 italic">
              * Nota: Valores com base na taxa cadastrada de juros. O banco pode aplicar alíquotas de IOF e tarifas adicionais.
            </p>
          </div>
        )}

        {/* ALERTA 2: ALERTA LARANJA SE CHEQUE ESPECIAL UTILIZADO > 80% */}
        {alerta_critico_cheque && limite_cheque_total > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800">
                Alerta Crítico: Mais de 80% do cheque especial utilizado ({percentual_cheque_usado.toFixed(1)}%)
              </p>
              <p className="text-amber-700 mt-0.5 leading-relaxed">
                Resta apenas <strong>{formatarValor(cheque_especial_disponivel)}</strong> de limite de segurança bancário. Priorize entradas ou evite novos pagamentos nesta conta para não estourar o limite.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* RODAPÉ DO CARD (Quando for conta individual) */}
      {!isConsolidado && conta && podeEditar && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleAtiva}
              type="button"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                conta.ativa
                  ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {conta.ativa ? 'Conta Ativa' : 'Conta Inativa (Oculta)'}
            </button>
            <span className="text-[11px] text-slate-400">
              {conta.banco} • {conta.tipo.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onEditar && (
              <button
                onClick={onEditar}
                type="button"
                className="text-slate-600 hover:text-[#003064] font-medium text-xs cursor-pointer"
              >
                Editar
              </button>
            )}
            {onExcluir && (
              <button
                onClick={onExcluir}
                type="button"
                className="text-red-600 hover:text-red-800 font-medium text-xs cursor-pointer"
              >
                Excluir
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

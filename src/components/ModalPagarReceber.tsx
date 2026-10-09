import React, { useState, useEffect } from 'react';
import { Lancamento, ContaBancaria } from '../types';
import { dbService } from '../services/storage';
import { formatarMoeda, formatarDataBR } from '../utils/formatters';
import { Modal } from './Modal';
import {
  Wallet,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Percent,
  TrendingDown,
  TrendingUp,
  XCircle,
  HelpCircle
} from 'lucide-react';

interface ModalPagarReceberProps {
  isOpen: boolean;
  onClose: () => void;
  lancamentosAlvo: Lancamento[]; // Pode ser 1 ou múltiplos (lote)
  tipoOperacao: 'pagar' | 'receber';
  onSucesso: () => void;
}

export const ModalPagarReceber: React.FC<ModalPagarReceberProps> = ({
  isOpen,
  onClose,
  lancamentosAlvo,
  tipoOperacao,
  onSucesso,
}) => {
  const contas = dbService.getContas().filter((c) => c.ativa);

  // Conta padrão: a conta do primeiro lançamento ou a primeira conta ativa
  const contaPadraoId =
    lancamentosAlvo.length > 0 && contas.some((c) => c.id === lancamentosAlvo[0].conta_id)
      ? lancamentosAlvo[0].conta_id
      : contas[0]?.id || '';

  const [contaSelecionadaId, setContaSelecionadaId] = useState(contaPadraoId);
  const [dataPagamento, setDataPagamento] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [jurosMulta, setJurosMulta] = useState('0');
  const [desconto, setDesconto] = useState('0');
  const [confirmouChequeEspecial, setConfirmouChequeEspecial] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContaSelecionadaId(contaPadraoId);
      setDataPagamento(new Date().toISOString().split('T')[0]);
      setJurosMulta('0');
      setDesconto('0');
      setConfirmouChequeEspecial(false);
    }
  }, [isOpen, contaPadraoId]);

  if (!isOpen || lancamentosAlvo.length === 0) return null;

  const isLote = lancamentosAlvo.length > 1;
  const isPagar = tipoOperacao === 'pagar';

  const conta = contas.find((c) => c.id === contaSelecionadaId);
  const resumoConta = conta ? dbService.calcularResumoConta(conta) : null;

  const valorOriginalTotal = lancamentosAlvo.reduce((acc, l) => acc + l.valor, 0);
  const numJuros = Number(jurosMulta) || 0;
  const numDesconto = Number(desconto) || 0;

  // Valor final a pagar ou receber
  const valorFinalTotal = isLote
    ? valorOriginalTotal
    : +(valorOriginalTotal + numJuros - numDesconto).toFixed(2);

  // SIMULAÇÃO ANTES DE CONFIRMAR
  const saldoRealHoje = resumoConta?.saldo_real || 0;
  const limiteCheque = conta?.limite_cheque_especial || 0;
  const disponivelTotalHoje = saldoRealHoje + limiteCheque;

  // Saldo real depois
  const saldoRealDepois = isPagar
    ? +(saldoRealHoje - valorFinalTotal).toFixed(2)
    : +(saldoRealHoje + valorFinalTotal).toFixed(2);

  // Disponível total depois
  const disponivelTotalDepois = saldoRealDepois + limiteCheque;

  // Vai usar cheque especial?
  const vaiUsarCheque = saldoRealDepois < 0;
  const valorChequeUsadoDepois = vaiUsarCheque ? Math.abs(saldoRealDepois) : 0;

  // Ultrapassou o limite do cheque especial?
  const estourouLimite = isPagar && disponivelTotalDepois < 0;
  const valorExcedente = estourouLimite ? Math.abs(disponivelTotalDepois) : 0;

  const handleConfirmar = (e: React.FormEvent) => {
    e.preventDefault();

    if (estourouLimite) {
      alert('Operação bloqueada: o valor a pagar excede o saldo real somado ao limite do cheque especial disponível.');
      return;
    }

    if (vaiUsarCheque && !confirmouChequeEspecial) {
      alert('Por favor, marque a caixa confirmando que está ciente do uso do cheque especial.');
      return;
    }

    if (isLote) {
      dbService.liquidarLancamentosEmLote({
        ids: lancamentosAlvo.map((l) => l.id),
        contaId: contaSelecionadaId,
        dataPagamento,
      });
    } else {
      dbService.liquidarLancamento({
        id: lancamentosAlvo[0].id,
        contaId: contaSelecionadaId,
        dataPagamento,
        jurosMulta: numJuros,
        desconto: numDesconto,
        valorFinal: valorFinalTotal,
      });
    }

    onSucesso();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isPagar
          ? isLote
            ? `Pagamento em Lote (${lancamentosAlvo.length} títulos)`
            : 'Confirmar Pagamento de Despesa'
          : isLote
          ? `Recebimento em Lote (${lancamentosAlvo.length} títulos)`
          : 'Confirmar Recebimento de Receita'
      }
      subtitle={
        isPagar
          ? 'Simulação de impacto financeiro em tempo real e conciliação de caixa MT Solar'
          : 'Crédito do valor na conta bancária e quitação de títulos contratuais'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleConfirmar} className="space-y-4">
        
        {/* Identificação do(s) Título(s) */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2 text-xs">
          {isLote ? (
            <div>
              <p className="font-bold text-[#003064]">
                {lancamentosAlvo.length} lançamentos selecionados para quitação conjunta:
              </p>
              <div className="max-h-24 overflow-y-auto mt-1 space-y-1 pr-1 divide-y divide-slate-200">
                {lancamentosAlvo.map((l) => (
                  <div key={l.id} className="pt-1 flex justify-between text-[11px]">
                    <span className="truncate max-w-[260px] text-slate-700">{l.descricao}</span>
                    <strong className="font-serif">{formatarMoeda(l.valor)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Título:</span>
              <p className="font-bold text-sm text-[#003064]">{lancamentosAlvo[0].descricao}</p>
              <p className="text-[11px] text-slate-500">
                Vencimento original: {formatarDataBR(lancamentosAlvo[0].data_vencimento)}
              </p>
            </div>
          )}
        </div>

        {/* Escolha da Conta e Data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isPagar ? 'Conta de onde sai o dinheiro *' : 'Conta onde entra o dinheiro *'}
            </label>
            <select
              value={contaSelecionadaId}
              onChange={(e) => setContaSelecionadaId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
              required
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.banco})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isPagar ? 'Data do Pagamento *' : 'Data do Recebimento *'}
            </label>
            <input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
              required
            />
          </div>
        </div>

        {/* Ajustes: Juros / Multa e Desconto (Apenas individual) */}
        {!isLote && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F5F7FA] p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Valor Original
              </label>
              <div className="font-serif font-bold text-xs text-slate-700 py-1.5">
                {formatarMoeda(valorOriginalTotal)}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-red-700 mb-1">
                (+) Juros / Multa (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={jurosMulta}
                onChange={(e) => setJurosMulta(e.target.value)}
                placeholder="0.00"
                className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-emerald-700 mb-1">
                (-) Desconto Obtido (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                placeholder="0.00"
                className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>
        )}

        {/* Valor Total Efetivo */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs">
          <span className="font-bold text-slate-700">
            {isPagar ? 'Valor Total a Ser Pago:' : 'Valor Total a Ser Recebido:'}
          </span>
          <span className={`font-serif font-black text-lg ${
            isPagar ? 'text-red-600' : 'text-[#16A34A]'
          }`}>
            {formatarMoeda(valorFinalTotal)}
          </span>
        </div>

        {/* SIMULAÇÃO ANTES DE PAGAR (REQUISITO CRÍTICO) */}
        <div className="p-4 rounded-xl border space-y-3 bg-linear-to-b from-white to-slate-50 border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#003064] flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-[#1A4A85]" />
              Simulação de Impacto no Saldo da Conta
            </span>
            <span className="text-[10px] text-slate-500">
              Conta: <strong>{conta?.nome}</strong>
            </span>
          </div>

          {/* Comparativo: Saldo real hoje -> Saldo real depois */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                Saldo Real Hoje
              </span>
              <span className={`font-serif font-bold text-sm ${
                saldoRealHoje >= 0 ? 'text-[#003064]' : 'text-red-600'
              }`}>
                {formatarMoeda(saldoRealHoje)}
              </span>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400" />

            <div className="text-right">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                Depois {isPagar ? 'deste pagamento' : 'deste recebimento'}
              </span>
              <span className={`font-serif font-black text-base ${
                saldoRealDepois >= 0 ? 'text-[#16A34A]' : 'text-red-600'
              }`}>
                {formatarMoeda(saldoRealDepois)}
              </span>
            </div>
          </div>

          {/* ALERTA 1: SE O SALDO REAL FICAR NEGATIVO (USO DE CHEQUE ESPECIAL) */}
          {isPagar && vaiUsarCheque && !estourouLimite && (
            <div className="p-3.5 rounded-xl bg-red-50 border-2 border-red-300 text-red-900 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                <p className="font-bold text-xs text-red-700">
                  Atenção: Isso vai usar {formatarMoeda(valorChequeUsadoDepois)} do cheque especial!
                </p>
              </div>
              <p className="text-[11px] text-red-800 leading-relaxed">
                A conta ficará negativa em {formatarMoeda(saldoRealDepois)}. O limite contratado é de {formatarMoeda(limiteCheque)}, restando {formatarMoeda(disponivelTotalDepois)} livres.
              </p>

              {/* Pedir confirmação extra */}
              <label className="flex items-start gap-2 pt-1 border-t border-red-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmouChequeEspecial}
                  onChange={(e) => setConfirmouChequeEspecial(e.target.checked)}
                  className="mt-0.5 rounded-sm border-red-300 text-red-600 focus:ring-red-600"
                />
                <span className="text-xs font-semibold text-red-900">
                  Estou ciente de que a MT Solar utilizará o limite do cheque especial e confirmação é mandatória.
                </span>
              </label>
            </div>
          )}

          {/* ALERTA 2: SE O PAGAMENTO ULTRAPASSAR O LIMITE DO CHEQUE ESPECIAL */}
          {estourouLimite && (
            <div className="p-3.5 rounded-xl bg-red-100 border-2 border-red-500 text-red-950 space-y-1.5 animate-in shake">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-700 shrink-0" />
                <p className="font-bold text-xs text-red-900">
                  Operação Bloqueada: Valor excede o disponível total no banco!
                </p>
              </div>
              <p className="text-xs text-red-900 leading-relaxed">
                O saldo real ({formatarMoeda(saldoRealHoje)}) somado ao limite do cheque especial ({formatarMoeda(limiteCheque)}) totaliza <strong>{formatarMoeda(disponivelTotalHoje)}</strong>.
                Faltam <strong>{formatarMoeda(valorExcedente)}</strong> para cobrir este pagamento.
              </p>
              <p className="text-[11px] text-red-800 italic">
                Transfira saldo de outra conta ou realize um aporte antes de confirmar esta baixa.
              </p>
            </div>
          )}

        </div>

        {/* Botões do Modal */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            disabled={estourouLimite || (isPagar && vaiUsarCheque && !confirmouChequeEspecial)}
            className={`px-5 py-2 text-xs font-semibold rounded-xl text-white shadow-xs transition-all cursor-pointer ${
              isPagar
                ? 'bg-red-600 hover:bg-red-700 disabled:opacity-50 border-b-2 border-red-800'
                : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 border-b-2 border-emerald-800'
            }`}
          >
            {isPagar
              ? isLote
                ? `Confirmar Pagamento de ${lancamentosAlvo.length} Títulos`
                : 'Confirmar Pagamento'
              : isLote
              ? `Confirmar Recebimento de ${lancamentosAlvo.length} Títulos`
              : 'Confirmar Recebimento'}
          </button>
        </div>

      </form>
    </Modal>
  );
};

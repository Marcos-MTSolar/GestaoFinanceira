import React, { useState } from 'react';
import { ContaBancaria } from '../types';
import { dbService } from '../services/storage';
import { formatarMoeda } from '../utils/formatters';
import { Modal } from './Modal';
import {
  Scale,
  Landmark,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface ConciliacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  conta: ContaBancaria | null;
}

export const ConciliacaoModal: React.FC<ConciliacaoModalProps> = ({
  isOpen,
  onClose,
  conta,
}) => {
  const [valorInformado, setValorInformado] = useState('');
  const [tipoInformado, setTipoInformado] = useState<'sem_limite' | 'com_limite'>('sem_limite');
  const [dataAjuste, setDataAjuste] = useState(new Date().toISOString().split('T')[0]);
  const [observacoes, setObservacoes] = useState('');
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  if (!conta) return null;

  const resumoAtual = dbService.calcularResumoConta(conta);
  const saldoRealAtual = resumoAtual.saldo_real;
  const limiteCheque = conta.limite_cheque_especial || 0;

  const numInformado = Number(valorInformado);
  const temValor = valorInformado.trim() !== '' && !isNaN(numInformado);

  let saldoRealEsperado = 0;
  let diferenca = 0;

  if (temValor) {
    if (tipoInformado === 'sem_limite') {
      saldoRealEsperado = numInformado;
    } else {
      saldoRealEsperado = numInformado - limiteCheque;
    }
    diferenca = +(saldoRealEsperado - saldoRealAtual).toFixed(2);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!temValor) return;

    const res = dbService.conciliarSaldoConta({
      contaId: conta.id,
      valorInformado: numInformado,
      tipoInformado,
      dataAjuste,
      observacoes: observacoes.trim(),
    });

    if (res.sucesso) {
      setSucessoMsg(
        res.diferenca === 0
          ? 'Saldos já estavam perfeitamente conciliados!'
          : `Ajuste de conciliação de ${formatarMoeda(Math.abs(res.diferenca))} realizado com sucesso!`
      );
      setTimeout(() => {
        setSucessoMsg(null);
        onClose();
        setValorInformado('');
        setObservacoes('');
      }, 1200);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Conciliação & Ajuste – ${conta.nome}`}
      subtitle={`Alinhe o saldo do sistema com o extrato real fornecido pelo banco • ${conta.banco}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Painel comparativo de saldos atuais no App */}
        <div className="bg-[#F5F7FA] p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
          <div className="flex justify-between items-center text-slate-600">
            <span>Saldo Real atual no App (sem limite):</span>
            <strong className={`font-serif text-sm ${
              saldoRealAtual >= 0 ? 'text-[#003064]' : 'text-red-600'
            }`}>
              {formatarMoeda(saldoRealAtual)}
            </strong>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span>Limite de cheque especial:</span>
            <span className="font-semibold text-slate-800">{formatarMoeda(limiteCheque)}</span>
          </div>
          <div className="flex justify-between items-center text-slate-700 pt-1 border-t border-slate-200">
            <span>Saldo disponível total no App (com limite):</span>
            <span className="font-bold text-[#003064]">{formatarMoeda(resumoAtual.saldo_disponivel_total)}</span>
          </div>
        </div>

        {/* Escolha do tipo de valor informado */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            O que você está informando do extrato do banco? *
          </label>
          <div className="space-y-2">
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="radio"
                name="tipo-conciliacao"
                checked={tipoInformado === 'sem_limite'}
                onChange={() => setTipoInformado('sem_limite')}
                className="mt-0.5 text-[#003064] focus:ring-[#003064]"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">
                  Saldo da Conta (Sem Limite)
                </span>
                <span className="text-[11px] text-slate-500">
                  Saldo líquido real em conta (pode estar positivo ou negativo se estiver usando o cheque).
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="radio"
                name="tipo-conciliacao"
                checked={tipoInformado === 'com_limite'}
                onChange={() => setTipoInformado('com_limite')}
                className="mt-0.5 text-[#003064] focus:ring-[#003064]"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">
                  Saldo Disponível (Com Limite)
                </span>
                <span className="text-[11px] text-slate-500">
                  Valor total que o app do banco mostra para gastar (já somando o limite contratado de R$ {limiteCheque.toLocaleString('pt-BR')}).
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Valor mostrado no banco */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Valor que o banco mostra hoje (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              value={valorInformado}
              onChange={(e) => setValorInformado(e.target.value)}
              placeholder="Ex: 24500.50 ou -1200.00"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data da Conciliação *
            </label>
            <input
              type="date"
              value={dataAjuste}
              onChange={(e) => setDataAjuste(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
              required
            />
          </div>
        </div>

        {/* Prévia da Diferença Calculada */}
        {temValor && (
          <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
            diferenca === 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <div className="flex justify-between items-center font-semibold">
              <span>Saldo Real Calculado que deve ficar:</span>
              <span className="font-serif font-bold text-sm">{formatarMoeda(saldoRealEsperado)}</span>
            </div>

            <div className="flex justify-between items-center font-bold pt-1 border-t border-amber-200/60">
              <span>Diferença apurada:</span>
              <span className={`font-serif text-sm ${diferenca >= 0 ? 'text-[#16A34A]' : 'text-red-600'}`}>
                {diferenca > 0 ? '+' : ''}{formatarMoeda(diferenca)}
              </span>
            </div>

            <p className="text-[11px] text-slate-600 mt-1">
              {diferenca > 0
                ? `Será criado um lançamento de ajuste de RECEITA de ${formatarMoeda(diferenca)} para elevar o saldo da conta.`
                : diferenca < 0
                ? `Será criado um lançamento de ajuste de DESPESA de ${formatarMoeda(Math.abs(diferenca))} para reduzir o saldo da conta.`
                : 'Nenhum lançamento de ajuste necessário. O saldo já está 100% alinhado.'}
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Motivo do Ajuste (Opcional)
          </label>
          <input
            type="text"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Conciliação extrato Itaú dia 07/10, tarifa de pacote não lançada"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
          />
        </div>

        {sucessoMsg && (
          <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{sucessoMsg}</span>
          </div>
        )}

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
            disabled={!temValor}
            className="px-5 py-2 text-xs font-semibold bg-[#003064] hover:bg-[#00204A] text-white rounded-xl shadow-xs border-b-2 border-[#FCBC00] disabled:opacity-50 cursor-pointer"
          >
            Confirmar e Ajustar Saldo
          </button>
        </div>

      </form>
    </Modal>
  );
};

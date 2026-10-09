import React, { useState } from 'react';
import { ContaBancaria } from '../types';
import { dbService } from '../services/storage';
import { Modal } from './Modal';
import { ArrowRightLeft, Landmark, AlertCircle } from 'lucide-react';

interface TransferenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  contas: ContaBancaria[];
  contaOrigemPreSelecionada?: string;
}

export const TransferenciaModal: React.FC<TransferenciaModalProps> = ({
  isOpen,
  onClose,
  contas,
  contaOrigemPreSelecionada,
}) => {
  const [contaOrigemId, setContaOrigemId] = useState(
    contaOrigemPreSelecionada || contas[0]?.id || ''
  );
  const [contaDestinoId, setContaDestinoId] = useState(
    contas.find((c) => c.id !== (contaOrigemPreSelecionada || contas[0]?.id))?.id || ''
  );
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  // Sincronizar se a prop mudar
  React.useEffect(() => {
    if (contaOrigemPreSelecionada) {
      setContaOrigemId(contaOrigemPreSelecionada);
      const outra = contas.find((c) => c.id !== contaOrigemPreSelecionada);
      if (outra) setContaDestinoId(outra.id);
    }
  }, [contaOrigemPreSelecionada, contas]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const numValor = Number(valor);
    if (isNaN(numValor) || numValor <= 0) {
      setErro('Informe um valor de transferência válido maior que zero.');
      return;
    }

    if (contaOrigemId === contaDestinoId) {
      setErro('A conta de origem e destino devem ser diferentes.');
      return;
    }

    const res = dbService.transferirEntreContas({
      contaOrigemId,
      contaDestinoId,
      valor: numValor,
      data,
      observacoes: observacoes.trim(),
    });

    if (!res.sucesso && res.mensagem) {
      setErro(res.mensagem);
      return;
    }

    onClose();
    setValor('');
    setObservacoes('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transferência Entre Contas"
      subtitle="Movimentação financeira interna da MT Solar (não gera receita nem despesa operacional)"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {erro && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Conta de Origem (Saída) *
            </label>
            <select
              value={contaOrigemId}
              onChange={(e) => setContaOrigemId(e.target.value)}
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
              Conta de Destino (Entrada) *
            </label>
            <select
              value={contaDestinoId}
              onChange={(e) => setContaDestinoId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
              required
            >
              {contas
                .filter((c) => c.id !== contaOrigemId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.banco})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Valor da Transferência (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data da Movimentação *
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Motivo / Observações
          </label>
          <input
            type="text"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Transferência de saldo para folha, cobertura de cheque, etc."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
          />
        </div>

        <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-[11px] text-[#003064]">
          <strong>Regra Contábil:</strong> Serão criados dois lançamentos automáticos vinculados (uma saída na origem e uma entrada no destino). Esses lançamentos não impactam o DRE operacional nem a contagem de faturamento da empresa.
        </div>

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
            className="px-5 py-2 text-xs font-semibold bg-[#003064] hover:bg-[#00204A] text-white rounded-xl shadow-xs border-b-2 border-[#FCBC00] cursor-pointer"
          >
            Realizar Transferência
          </button>
        </div>
      </form>
    </Modal>
  );
};

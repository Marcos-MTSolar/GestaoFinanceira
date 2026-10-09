import React, { useState } from 'react';
import { Lancamento } from '../types';
import { Modal } from './Modal';
import { Trash2, AlertTriangle } from 'lucide-react';

interface ModalConfirmarExclusaoProps {
  isOpen: boolean;
  onClose: () => void;
  lancamento: Lancamento | null;
  onConfirmar: (escopo: 'so_esta' | 'futuras' | 'todas') => void;
}

export const ModalConfirmarExclusao: React.FC<ModalConfirmarExclusaoProps> = ({
  isOpen,
  onClose,
  lancamento,
  onConfirmar,
}) => {
  const [escopo, setEscopo] = useState<'so_esta' | 'futuras' | 'todas'>('so_esta');

  if (!isOpen || !lancamento) return null;

  const temGrupo = !!(lancamento.grupo_parcelas_id || lancamento.grupo_recorrencia_id);

  const handleExcluir = () => {
    onConfirmar(escopo);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar Exclusão de Lançamento"
      subtitle={lancamento.descricao}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p>
            Esta ação removerá o registro financeiro selecionado do sistema.
          </p>
        </div>

        {temGrupo ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Este lançamento faz parte de um grupo de parcelas ou recorrência. Como deseja excluir?
            </label>

            <div className="space-y-2 text-xs">
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="escopo-exclusao"
                  value="so_esta"
                  checked={escopo === 'so_esta'}
                  onChange={() => setEscopo('so_esta')}
                  className="mt-0.5 text-[#003064] focus:ring-[#003064]"
                />
                <div>
                  <strong className="text-slate-800 block">Excluir somente esta parcela</strong>
                  <span className="text-slate-500 text-[11px]">As demais parcelas do contrato permanecerão inalteradas.</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="escopo-exclusao"
                  value="futuras"
                  checked={escopo === 'futuras'}
                  onChange={() => setEscopo('futuras')}
                  className="mt-0.5 text-[#003064] focus:ring-[#003064]"
                />
                <div>
                  <strong className="text-slate-800 block">Excluir esta e as futuras</strong>
                  <span className="text-slate-500 text-[11px]">Remove a parcela atual e todas as subsequentes ainda não vencidas.</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="escopo-exclusao"
                  value="todas"
                  checked={escopo === 'todas'}
                  onChange={() => setEscopo('todas')}
                  className="mt-0.5 text-[#003064] focus:ring-[#003064]"
                />
                <div>
                  <strong className="text-slate-800 block">Excluir todas as parcelas do grupo</strong>
                  <span className="text-slate-500 text-[11px]">Remove todas as parcelas deste contrato vinculadas.</span>
                </div>
              </label>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600">
            Deseja realmente remover o lançamento <strong>"{lancamento.descricao}"</strong>?
          </p>
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
            type="button"
            onClick={handleExcluir}
            className="px-5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir Lançamento</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

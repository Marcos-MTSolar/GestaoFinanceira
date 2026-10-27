import React, { useState, useMemo, useEffect } from 'react';
import { Lancamento } from '../types';
import { Modal } from './Modal';
import { Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import { selecionarParaExcluir, EscopoExclusao } from '../utils/recorrencia';
import { dbService } from '../services/storage';

interface ModalConfirmarExclusaoProps {
  isOpen: boolean;
  onClose: () => void;
  lancamento: Lancamento | null;
  onConfirmar: (escopo: EscopoExclusao) => void;
  todosLancamentos?: Lancamento[];
}

export const ModalConfirmarExclusao: React.FC<ModalConfirmarExclusaoProps> = ({
  isOpen,
  onClose,
  lancamento,
  onConfirmar,
  todosLancamentos,
}) => {
  const [escopo, setEscopo] = useState<EscopoExclusao>('so_esta');

  // Resetar escopo para 'so_esta' quando modal abre ou lancamento muda
  useEffect(() => {
    if (isOpen) {
      setEscopo('so_esta');
    }
  }, [isOpen, lancamento?.id]);

  const lista = todosLancamentos || dbService.getLancamentos();

  const idsParaExcluir = useMemo(() => {
    if (!lancamento) return [];
    return selecionarParaExcluir(lista, lancamento.id, escopo);
  }, [lista, lancamento, escopo]);

  if (!isOpen || !lancamento) return null;

  const temGrupo = !!(lancamento.grupo_parcelas_id || lancamento.grupo_recorrencia_id);
  const modeloRecorrencia = useMemo(() => {
    if (!lancamento?.grupo_recorrencia_id) return null;
    return dbService.getRecorrencias().find((r) => r.id === lancamento.grupo_recorrencia_id) || null;
  }, [lancamento]);
  const alvoPago = lancamento.status === 'pago';
  const qtdExcluir = idsParaExcluir.length;

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
        {alvoPago && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="font-semibold">
              Este lançamento já está pago; excluí-lo altera o saldo da conta.
            </p>
          </div>
        )}

        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p>
            Esta ação removerá o registro financeiro selecionado do sistema.
          </p>
        </div>

        {temGrupo ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              {modeloRecorrencia
                ? 'Este lançamento faz parte de uma recorrência periódica. Como deseja excluir?'
                : 'Este lançamento faz parte de um grupo de parcelas ou recorrência. Como deseja excluir?'}
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
                  <strong className="text-slate-800 block">Só este lançamento</strong>
                  <span className="text-slate-500 text-[11px]">
                    {modeloRecorrencia
                      ? 'Exclui apenas o lançamento deste mês. A recorrência continuará nos próximos meses.'
                      : 'As demais parcelas do contrato permanecerão inalteradas.'}
                  </span>
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
                  <strong className="text-slate-800 block">
                    {modeloRecorrencia
                      ? 'Este e os próximos (e parar de gerar novos meses)'
                      : 'Este e os próximos pendentes'}
                  </strong>
                  <span className="text-slate-500 text-[11px]">
                    {modeloRecorrencia
                      ? 'Remove este lançamento, as ocorrências futuras pendentes e encerra a recorrência.'
                      : 'Remove este lançamento e todas as parcelas futuras pendentes.'}
                  </span>
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
                  <strong className="text-slate-800 block">
                    {modeloRecorrencia
                      ? 'Todos os pendentes do grupo (e parar de gerar novos meses)'
                      : 'Todos os pendentes do grupo (os já pagos são mantidos)'}
                  </strong>
                  <span className="text-slate-500 text-[11px]">
                    {modeloRecorrencia
                      ? 'Remove todos os lançamentos pendentes deste grupo e encerra a recorrência (os já pagos são mantidos).'
                      : 'Remove todas as parcelas pendentes deste grupo vinculadas.'}
                  </span>
                </div>
              </label>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600">
            Deseja realmente remover o lançamento <strong>"{lancamento.descricao}"</strong>?
          </p>
        )}

        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center justify-between">
          <span className="text-slate-600">Total a excluir:</span>
          <span className="font-bold text-red-600">
            {qtdExcluir} {qtdExcluir === 1 ? 'lançamento será excluído' : 'lançamentos serão excluídos'}
          </span>
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
            type="button"
            onClick={handleExcluir}
            className="px-5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir {qtdExcluir > 1 ? `(${qtdExcluir}) Lançamentos` : 'Lançamento'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

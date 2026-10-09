import React, { useState } from 'react';
import { usePrivacy } from '../context/PrivacyContext';
import { formatarMoeda, formatarDataBR } from '../utils/formatters';
import { ContaBancaria } from '../types';
import { dbService } from '../services/storage';
import { Modal } from './Modal';
import {
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Calendar,
  Search,
  CheckCircle2,
  Filter,
  FileSpreadsheet,
  Download
} from 'lucide-react';

interface ExtratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  conta: ContaBancaria | null;
}

export const ExtratoModal: React.FC<ExtratoModalProps> = ({
  isOpen,
  onClose,
  conta,
}) => {
  const { formatarValor } = usePrivacy();
  const [busca, setBusca] = useState('');
  const [mesFiltro, setMesFiltro] = useState('todos');

  if (!conta) return null;

  const dadosExtrato = dbService.obterExtratoConta(conta.id);
  if (!dadosExtrato) return null;

  const { saldo_inicial, data_saldo_inicial, linhas, resumoAtual } = dadosExtrato;

  const linhasFiltradas = linhas.filter(({ lancamento }) => {
    if (mesFiltro !== 'todos') {
      const dataL = (lancamento.data_pagamento || lancamento.data_vencimento).slice(0, 7);
      if (dataL !== mesFiltro) return false;
    }
    if (busca) {
      const q = busca.toLowerCase();
      const desc = lancamento.descricao.toLowerCase().includes(q);
      const obs = lancamento.observacoes?.toLowerCase().includes(q);
      if (!desc && !obs) return false;
    }
    return true;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Extrato Bancário – ${conta.nome}`}
      subtitle={`Movimentações liquidadas com saldo real acumulado linha a linha • ${conta.banco}`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        
        {/* Resumo do Topo do Extrato */}
        <div className="bg-[#F5F7FA] p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Saldo Inicial ({formatarDataBR(data_saldo_inicial)})
            </span>
            <span className="font-serif font-bold text-sm text-slate-700">
              {formatarValor(saldo_inicial)}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Saldo Real Atual
            </span>
            <span className={`font-serif font-black text-base ${
              resumoAtual.saldo_real >= 0 ? 'text-[#16A34A]' : 'text-red-600'
            }`}>
              {formatarValor(resumoAtual.saldo_real)}
            </span>
            {resumoAtual.usando_cheque_especial && (
              <span className="text-[10px] text-red-600 font-semibold block">
                Usando cheque especial
              </span>
            )}
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Limite Cheque Especial
            </span>
            <span className="font-serif font-bold text-sm text-slate-800">
              {formatarValor(conta.limite_cheque_especial)}
            </span>
            <span className="text-[10px] text-slate-400 block">
              Disponível: {formatarValor(resumoAtual.cheque_especial_disponivel)}
            </span>
          </div>
        </div>

        {/* Barra de Filtros do Extrato */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar lançamentos..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#003064]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white w-full sm:w-auto"
            >
              <option value="todos">Todos os Períodos</option>
              <option value="2026-03">Março / 2026</option>
              <option value="2026-02">Fevereiro / 2026</option>
              <option value="2026-01">Janeiro / 2026</option>
            </select>
          </div>
        </div>

        {/* Tabela do Extrato Cronológico */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[55vh] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100/95 border-b border-slate-200 text-slate-600 font-semibold z-10 backdrop-blur-xs">
              <tr>
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Descrição / Operação</th>
                <th className="py-2.5 px-3 text-right">Valor</th>
                <th className="py-2.5 px-3 text-right">Saldo Real Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              
              {/* Linha 0: Ponto de partida do Saldo Inicial */}
              <tr className="bg-slate-50 font-medium text-slate-600">
                <td className="py-2 px-3 whitespace-nowrap">
                  {formatarDataBR(data_saldo_inicial)}
                </td>
                <td className="py-2 px-3">
                  <span className="font-semibold text-slate-700">Saldo Inicial Definido</span>
                  <span className="text-[10px] text-slate-400 block">Início da conciliação da conta</span>
                </td>
                <td className="py-2 px-3 text-right text-slate-500 font-mono">
                  -
                </td>
                <td className="py-2 px-3 text-right font-serif font-bold text-slate-800">
                  {formatarValor(saldo_inicial)}
                </td>
              </tr>

              {linhasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Nenhum lançamento pago registrado nesta conta para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                linhasFiltradas.map(({ lancamento, saldo_real_acumulado, usando_cheque, valor_cheque_usado }, idx) => {
                  const eReceita = lancamento.tipo === 'receita';

                  return (
                    <tr
                      key={lancamento.id || idx}
                      className={`transition-colors ${
                        usando_cheque
                          ? 'bg-red-50/70 hover:bg-red-100/60'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Data */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-medium">
                        {formatarDataBR(lancamento.data_pagamento || lancamento.data_vencimento)}
                      </td>

                      {/* Descrição & Detalhes */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {eReceita ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          )}
                          <span className="truncate max-w-[260px]">{lancamento.descricao}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="capitalize">{lancamento.forma_pagamento}</span>
                          {lancamento.origem === 'transferencia' && (
                            <span className="bg-blue-100 text-[#003064] px-1.5 py-0.2 rounded-xs font-semibold">
                              Transferência Interna
                            </span>
                          )}
                          {lancamento.origem === 'ajuste' && (
                            <span className="bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded-xs font-semibold">
                              Ajuste / Conciliação
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Valor do Lançamento */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-serif font-bold">
                        <span className={eReceita ? 'text-[#16A34A]' : 'text-red-600'}>
                          {eReceita ? '+' : '-'} {formatarValor(lancamento.valor)}
                        </span>
                      </td>

                      {/* Saldo Real Acumulado (Destaque se negativo) */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className={`font-serif font-extrabold text-sm ${
                          saldo_real_acumulado >= 0 ? 'text-[#003064]' : 'text-red-600'
                        }`}>
                          {formatarValor(saldo_real_acumulado)}
                        </div>

                        {/* DESTAQUE NAS LINHAS EM QUE O SALDO FICOU NEGATIVO */}
                        {usando_cheque && (
                          <div className="inline-flex items-center gap-1 text-[9px] font-bold text-red-700 bg-red-200/80 px-1.5 py-0.5 rounded-sm mt-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Cheque Especial ({formatarValor(valor_cheque_usado)})</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé explicativo da Regra Central */}
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
          <strong>Regra Central do Extrato:</strong> O saldo real acumulado reflete rigorosamente o dinheiro em caixa da MT Solar após cada entrada ou saída. Quando o valor fica negativo (destacado em vermelho), significa que a operação entrou no cheque especial concedido pelo banco.
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 bg-[#003064] text-white rounded-xl text-xs font-semibold hover:bg-[#00204A]"
          >
            Fechar Extrato
          </button>
        </div>

      </div>
    </Modal>
  );
};

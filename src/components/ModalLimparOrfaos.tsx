import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  ArrowRightLeft,
  FileSpreadsheet,
  Sparkles,
  Layers,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';
import { dbService } from '../services/storage';
import { DryRunLimparOrfaos, ResultadoLimparOrfaos } from '../types';

function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Props {
  isOpen: boolean;
  onFechar: () => void;
}

type Etapa = 'simulando' | 'confirmacao' | 'executando' | 'resultado';

export const ModalLimparOrfaos: React.FC<Props> = ({ isOpen, onFechar }) => {
  const [etapa, setEtapa] = useState<Etapa>('simulando');

  // Opções
  const [removerComTransferencias, setRemoverComTransferencias] = useState(false);

  // Dados
  const [dryRun, setDryRun] = useState<DryRunLimparOrfaos | null>(null);
  const [resultado, setResultado] = useState<ResultadoLimparOrfaos | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Campo de confirmação
  const [textoConfirmacao, setTextoConfirmacao] = useState('');

  useEffect(() => {
    if (isOpen) {
      executarSimulacao();
    } else {
      // Resetar estado ao fechar
      setEtapa('simulando');
      setTextoConfirmacao('');
      setDryRun(null);
      setResultado(null);
      setErro(null);
      setRemoverComTransferencias(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, removerComTransferencias]);

  function executarSimulacao() {
    setEtapa('simulando');
    setErro(null);
    try {
      const res = dbService.simularLimpezaOrfaos({
        removerOrfaosComTransferencia: removerComTransferencias,
      });
      setDryRun(res);
      setEtapa('confirmacao');
    } catch (e: any) {
      setErro(e?.message || 'Erro ao simular limpeza de registros órfãos.');
      setEtapa('confirmacao');
    }
  }

  async function handleConfirmarLimpeza() {
    if (!dryRun) return;
    setEtapa('executando');
    setErro(null);

    try {
      const res = await dbService.limparHistoricoOrfao({
        textoConfirmacao,
        removerOrfaosComTransferencia: removerComTransferencias,
      });
      setResultado(res);
      setEtapa('resultado');
    } catch (e: any) {
      setErro(e?.message || 'Erro ao executar a limpeza de registros órfãos.');
      setEtapa('confirmacao');
    }
  }

  if (!isOpen) return null;

  const textoConfere = textoConfirmacao.trim().toUpperCase() === 'LIMPAR';
  const podeConfirmar =
    textoConfere && dryRun !== null && dryRun.tem_orfaos_para_limpar && etapa === 'confirmacao';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && etapa !== 'executando') onFechar();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#003064] text-white rounded-t-2xl shrink-0 border-b-2 border-[#FCBC00]">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-[#FCBC00] shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg font-bold">Limpeza de Histórico Órfão</h3>
                <span className="text-[10px] bg-[#FCBC00] text-[#003064] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Apenas Administrador
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Localização e remoção segura de dados remanescentes cujas contas bancárias não existem mais.
              </p>
            </div>
          </div>
          {etapa !== 'executando' && (
            <button
              type="button"
              onClick={onFechar}
              className="text-white/70 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-700 flex-1">
          {erro && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">Aviso:</p>
                <p className="mt-0.5">{erro}</p>
              </div>
            </div>
          )}

          {/* ETAPA: SIMULANDO */}
          {etapa === 'simulando' && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-8 h-8 text-[#003064] animate-spin" />
              <p className="text-sm font-semibold text-slate-700">
                Analisando lançamentos, lotes e regras órfãos no banco de dados...
              </p>
              <p className="text-xs text-slate-400">
                Verificando integridade referencial com contas existentes.
              </p>
            </div>
          )}

          {/* ETAPA: EXECUTANDO */}
          {etapa === 'executando' && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
              <div>
                <p className="text-base font-bold text-slate-800">
                  Executando Limpeza Segura em Lotes...
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Gerando backup completo, excluindo lançamentos órfãos em blocos no Firestore e atualizando os índices do sistema. Por favor, aguarde.
                </p>
              </div>
            </div>
          )}

          {/* ETAPA: RESULTADO */}
          {etapa === 'resultado' && resultado && (
            <div className="space-y-4">
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-emerald-900 text-sm">
                    Limpeza Concluída com Sucesso!
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    {resultado.mensagem}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                  <p className="text-[11px] text-slate-500 font-medium">Lançamentos Excluídos</p>
                  <p className="text-xl font-bold text-red-600 mt-1">
                    {resultado.total_lancamentos_excluidos}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                  <p className="text-[11px] text-slate-500 font-medium">Órfãos Preservados</p>
                  <p className="text-xl font-bold text-amber-600 mt-1">
                    {resultado.total_lancamentos_preservados}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                  <p className="text-[11px] text-slate-500 font-medium">Lotes Removidos</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">
                    {resultado.total_lotes_excluidos}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                  <p className="text-[11px] text-slate-500 font-medium">Regras Removidas</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">
                    {resultado.total_regras_excluidas}
                  </p>
                </div>
              </div>

              {resultado.total_contrapartidas_desvinculadas > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>{resultado.total_contrapartidas_desvinculadas}</strong> lançamento(s) em contas existentes tiveram seu vínculo desfeito, mantendo seus valores e saldos intactos.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ETAPA: CONFIRMAÇÃO (COM OU SEM ÓRFÃOS) */}
          {etapa === 'confirmacao' && dryRun && (
            <>
              {!dryRun.tem_orfaos_para_limpar ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="font-serif text-base font-bold text-slate-800">
                    Nenhum Histórico Órfão Encontrado
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md">
                    Todos os lançamentos, lotes de importação e regras do banco de dados estão devidamente associados a contas bancárias ativas e válidas. Não há ações necessárias.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Cards Resumo Geral */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-red-50 border border-red-200 p-3 rounded-xl">
                      <div className="flex items-center gap-2 text-red-700">
                        <Trash2 className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase">Lançamentos</span>
                      </div>
                      <p className="text-xl font-bold text-red-900 mt-1">
                        {dryRun.total_lancamentos_orfaos}
                      </p>
                      <p className="text-[10px] text-red-700 mt-0.5">Órfãos identificados</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                      <div className="flex items-center gap-2 text-amber-700">
                        <Layers className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase">Contas Inexistentes</span>
                      </div>
                      <p className="text-xl font-bold text-amber-900 mt-1">
                        {dryRun.grupos.length}
                      </p>
                      <p className="text-[10px] text-amber-700 mt-0.5">Origens órfãs</p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                      <div className="flex items-center gap-2 text-blue-700">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase">Lotes Importação</span>
                      </div>
                      <p className="text-xl font-bold text-blue-900 mt-1">
                        {dryRun.total_lotes_orfaos}
                      </p>
                      <p className="text-[10px] text-blue-700 mt-0.5">Na coleção importacoes</p>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl">
                      <div className="flex items-center gap-2 text-purple-700">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-[11px] font-bold uppercase">Regras Órfãs</span>
                      </div>
                      <p className="text-xl font-bold text-purple-900 mt-1">
                        {dryRun.total_regras_orfaos}
                      </p>
                      <p className="text-[10px] text-purple-700 mt-0.5">Específicas de contas mortas</p>
                    </div>
                  </div>

                  {/* Detalhamento por Grupo de Conta Inexistente */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        Grupos por conta_id inexistente
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {dryRun.grupos.length} grupo(s)
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      {dryRun.grupos.map((grupo) => (
                        <div key={grupo.conta_id} className="p-3.5 hover:bg-slate-50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                                  {grupo.conta_id}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {grupo.total_lancamentos} lançamento(s)
                                </span>
                                {grupo.total_lotes_importacao > 0 && (
                                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                                    {grupo.total_lotes_importacao} lote(s)
                                  </span>
                                )}
                                {grupo.total_regras_importacao > 0 && (
                                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                                    {grupo.total_regras_importacao} regra(s)
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Período: {grupo.data_mais_antiga} até {grupo.data_mais_recente}
                              </p>
                            </div>

                            <div className="flex items-center gap-4 text-xs font-num">
                              <div className="flex items-center gap-1 text-emerald-700">
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span className="font-bold">+{moeda(grupo.total_entradas)}</span>
                              </div>
                              <div className="flex items-center gap-1 text-red-700">
                                <TrendingDown className="w-3.5 h-3.5" />
                                <span className="font-bold">-{moeda(grupo.total_saidas)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Se este grupo tem transferências ligadas a contas existentes */}
                          {grupo.transferencias_com_contas_existentes.length > 0 && (
                            <div className="mt-2.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
                              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <span className="font-bold">
                                  Possui {grupo.transferencias_com_contas_existentes.length} transferência(s) vinculada(s) a conta(s) existente(s).
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BLOCO ESPECIAL: TRANSFERÊNCIAS COM CONTAS EXISTENTES */}
                  {dryRun.total_transferencias_com_contas_existentes > 0 && (
                    <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-3">
                      <div className="flex items-start gap-2.5">
                        <ArrowRightLeft className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-amber-950 text-xs uppercase tracking-wide">
                            Lançamentos de Transferência Vinculados a Contas Existentes ({dryRun.total_transferencias_com_contas_existentes})
                          </h4>
                          <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                            Foram identificados lançamentos órfãos cuja contrapartida está em uma conta bancária existente.
                            <strong> Os lançamentos de contas existentes NUNCA serão apagados.</strong>
                          </p>
                        </div>
                      </div>

                      {/* Lista das contas existentes afetadas e seu saldo */}
                      <div className="bg-white/80 rounded-xl p-3 border border-amber-200 space-y-2 text-xs">
                        <div className="font-semibold text-slate-700 flex items-center justify-between pb-1 border-b border-amber-200">
                          <span>Conta Existente</span>
                          <span>Saldo Atual (Permanecerá Inalterado)</span>
                        </div>
                        {dryRun.contas_existentes_afetadas.map((c) => (
                          <div key={c.conta_id} className="flex items-center justify-between font-num">
                            <span className="font-medium text-slate-800">{c.conta_nome} ({c.quantidade_transferencias} transf.)</span>
                            <span className="font-bold text-[#003064]">{moeda(c.saldo_atual)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Opção Explícita de Exclusão dos Órfãos Vinculados */}
                      <div className="pt-2 border-t border-amber-200">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={removerComTransferencias}
                            onChange={(e) => setRemoverComTransferencias(e.target.checked)}
                            className="mt-0.5 rounded border-amber-400 text-[#003064] focus:ring-[#003064]"
                          />
                          <span className="text-xs text-amber-950 leading-relaxed">
                            <strong>Autorizar exclusão dos lançamentos órfãos vinculados a transferências.</strong>{' '}
                            <span className="text-slate-600 block mt-0.5">
                              {removerComTransferencias
                                ? 'Os registros órfãos serão excluídos e as contrapartidas nas contas existentes terão seu vínculo desfeito, mantendo seus valores e saldos intactos.'
                                : 'Sem esta opção marcada, os lançamentos órfãos de transferência serão PRESERVADOS para manter o vínculo com a conta existente.'}
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Informação sobre o Backup Prévio Automático */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5 text-xs text-blue-900">
                    <Download className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Backup de Segurança:</strong> Antes de efetuar qualquer exclusão no banco, um arquivo JSON com o backup completo de todo o sistema será baixado automaticamente no seu navegador.
                    </span>
                  </div>

                  {/* Confirmação por Digitação */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Confirmação Obrigatória:
                    </label>
                    <p className="text-xs text-slate-500">
                      Para autorizar a remoção definitiva do histórico órfão, digite exatamente <strong className="text-red-600">LIMPAR</strong> abaixo:
                    </p>
                    <input
                      type="text"
                      value={textoConfirmacao}
                      onChange={(e) => setTextoConfirmacao(e.target.value)}
                      placeholder='Digite "LIMPAR"'
                      className="w-full px-3 py-2 text-sm font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onFechar}
            disabled={etapa === 'executando'}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            {etapa === 'resultado' ? 'Fechar' : 'Cancelar'}
          </button>

          {etapa === 'confirmacao' && dryRun && dryRun.tem_orfaos_para_limpar && (
            <button
              type="button"
              disabled={!podeConfirmar}
              onClick={handleConfirmarLimpeza}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-xs ${
                podeConfirmar
                  ? 'bg-red-700 hover:bg-red-800 cursor-pointer shadow-red-200'
                  : 'bg-slate-300 cursor-not-allowed opacity-60'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Remover Histórico Órfão</span>
            </button>
          )}

          {etapa === 'resultado' && (
            <button
              type="button"
              onClick={onFechar}
              className="px-5 py-2 text-xs font-bold bg-[#003064] text-white hover:bg-[#00204A] rounded-xl transition-all cursor-pointer shadow-xs border-b-2 border-[#FCBC00]"
            >
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

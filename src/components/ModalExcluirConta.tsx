import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Lock,
  ArrowRightLeft,
  Users,
  FileSpreadsheet,
  Settings2,
} from 'lucide-react';
import { dbService } from '../services/storage';
import { ContaBancaria, DryRunExclusaoConta, ResultadoExclusaoConta } from '../types';

function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Props {
  conta: ContaBancaria;
  onFechar: () => void;
}

type Etapa = 'simulando' | 'confirmacao' | 'executando' | 'resultado';

export const ModalExcluirConta: React.FC<Props> = ({ conta, onFechar }) => {
  const [etapa, setEtapa] = useState<Etapa>('simulando');

  // Opções
  const [excluirContrapartidas, setExcluirContrapartidas] = useState(false);

  // Resultados
  const [dryRun, setDryRun] = useState<DryRunExclusaoConta | null>(null);
  const [resultado, setResultado] = useState<ResultadoExclusaoConta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Campo de confirmação por digitação do nome
  const [textoConfirmacao, setTextoConfirmacao] = useState('');

  // Executa simulação sempre que a opção de contrapartida mudar
  useEffect(() => {
    executarSimulacao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excluirContrapartidas]);

  function executarSimulacao() {
    setEtapa('simulando');
    setErro(null);
    try {
      const res = dbService.simularExclusaoConta(conta.id, {
        excluirContrapartidasTransferencias: excluirContrapartidas,
      });
      setDryRun(res);
      setEtapa('confirmacao');
    } catch (e: any) {
      setErro(e?.message || 'Erro ao simular exclusão da conta.');
      setEtapa('confirmacao');
    }
  }

  async function handleConfirmarExclusao() {
    if (!dryRun) return;
    setEtapa('executando');
    setErro(null);

    try {
      const res = await dbService.excluirContaBancariaCompleta({
        contaId: conta.id,
        nomeConfirmacao: textoConfirmacao,
        excluirContrapartidasTransferencias: excluirContrapartidas,
      });
      setResultado(res);
      setEtapa('resultado');
    } catch (e: any) {
      setErro(e?.message || 'Erro ao excluir a conta bancária.');
      setEtapa('confirmacao');
    }
  }

  const nomeConfere = textoConfirmacao.trim().toLowerCase() === conta.nome.trim().toLowerCase();
  const bloqueadoPorTransferencia = dryRun?.bloqueado_por_transferencias ?? false;
  const podeExcluir = nomeConfere && !bloqueadoPorTransferencia && dryRun !== null && etapa === 'confirmacao';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && etapa !== 'executando') onFechar();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 bg-red-700 text-white rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-red-200 shrink-0" />
            <div>
              <h2 className="font-bold text-base leading-tight">Exclusão Definitiva de Conta Bancária</h2>
              <p className="text-xs text-red-200 mt-0.5">
                {conta.nome} • {conta.banco}
              </p>
            </div>
          </div>
          {etapa !== 'executando' && (
            <button
              onClick={onFechar}
              className="text-red-200 hover:text-white transition-colors cursor-pointer"
              title="Fechar"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* SIMULANDO */}
          {etapa === 'simulando' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
              <p className="text-sm font-medium">Analisando impactos e dependências da conta…</p>
            </div>
          )}

          {/* EXECUTANDO */}
          {etapa === 'executando' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-red-700">
                  Baixando backup completo e excluindo registros em lotes…
                </p>
                <p className="text-xs text-slate-500">
                  A conta bancária será removida por último após todos os lançamentos. Não feche esta janela.
                </p>
              </div>
            </div>
          )}

          {/* ERRO */}
          {erro && (
            <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-900">Atenção na Operação</p>
                <p className="mt-0.5 whitespace-pre-wrap">{erro}</p>
              </div>
            </div>
          )}

          {/* CONFIRMAÇÃO COM DRY-RUN */}
          {etapa === 'confirmacao' && dryRun && (
            <>
              {/* Alerta de Perigo Crítico */}
              <div className="p-4 bg-red-50 border border-red-300 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-900 space-y-1">
                  <p className="font-bold text-sm">Esta ação é irreversível.</p>
                  <p>
                    Ao excluir esta conta, <strong>todo o histórico financeiro dela sumirá</strong>. Nenhum lançamento
                    ficará órfão no sistema.
                  </p>
                  <p className="flex items-center gap-1.5 text-red-800 font-semibold pt-1">
                    <Download className="w-3.5 h-3.5" />
                    Um backup completo em JSON será baixado automaticamente no seu navegador antes da exclusão.
                  </p>
                </div>
              </div>

              {/* Seção 1: Lançamentos da Conta que Serão Apagados */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4" /> Lançamentos da Conta a Serem Apagados
                  </h3>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-red-100 text-red-800 rounded-full font-num">
                    Total: {dryRun.total_lancamentos_conta}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl">
                    <p className="text-slate-500 font-medium">Importados</p>
                    <p className="font-bold text-red-700 text-base font-num">
                      {dryRun.discriminacao_lancamentos.importados}
                    </p>
                    <span className="text-[10px] text-slate-400">Extratos bancários</span>
                  </div>

                  <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl">
                    <p className="text-slate-500 font-medium">Manuais</p>
                    <p className="font-bold text-red-700 text-base font-num">
                      {dryRun.discriminacao_lancamentos.manuais}
                    </p>
                    <span className="text-[10px] text-slate-400">Lançamentos pagos</span>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                    <p className="text-slate-500 font-medium">Pendentes</p>
                    <p className="font-bold text-amber-700 text-base font-num">
                      {dryRun.discriminacao_lancamentos.pendentes_pagar_receber}
                    </p>
                    <span className="text-[10px] text-slate-400">Contas a pagar/rec.</span>
                  </div>

                  <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                    <p className="text-slate-500 font-medium">De Folha</p>
                    <p className="font-bold text-purple-700 text-base font-num">
                      {dryRun.discriminacao_lancamentos.folha}
                    </p>
                    <span className="text-[10px] text-slate-400">Pagamentos de RH</span>
                  </div>
                </div>
              </section>

              {/* Seção 2: Folha de Pagamento */}
              {dryRun.registros_folha_sem_conta > 0 && (
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-purple-800">
                    <Users className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>Lançamentos de Folha de Pagamento</span>
                  </div>
                  <p>
                    Os lançamentos financeiros desta conta serão apagados, mas{' '}
                    <strong>nenhum funcionário nem registro da folha será excluído</strong>.
                  </p>
                  <p className="font-semibold text-purple-700">
                    ⚠️ {dryRun.registros_folha_sem_conta} registro(s) da folha ficarão sem conta de pagamento vinculada
                    e poderão ser quitados posteriormente por outra conta bancária.
                  </p>
                </div>
              )}

              {/* Seção 3: Coleção Importações e Regras */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-slate-600 shrink-0" />
                  <div>
                    <p className="text-slate-500 font-medium">Lotes de Importação</p>
                    <p className="font-bold text-slate-800 text-sm font-num">
                      {dryRun.total_lotes_importacoes} lote(s) da conta
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                  <Settings2 className="w-5 h-5 text-slate-600 shrink-0" />
                  <div>
                    <p className="text-slate-500 font-medium">Regras de Importação</p>
                    <p className="font-bold text-slate-800 text-sm font-num">
                      {dryRun.total_regras_importacao} regra(s) da conta
                    </p>
                  </div>
                </div>
              </div>

              {/* Seção 4: Transferências com OUTRAS Contas */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-slate-600" /> Transferências com Outras Contas
                </h3>

                {dryRun.total_transferencias_outras_contas === 0 ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Nenhuma transferência vinculada a outras contas bancárias. Nenhuma outra conta será afetada.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Alerta de bloqueio padrão */}
                    <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">
                            Contrapartidas detectadas ({dryRun.total_transferencias_outras_contas} transferência(s))
                          </p>
                          <p className="mt-0.5 text-amber-800">
                            Por padrão, a exclusão é <strong>BLOQUEADA</strong> porque a contrapartida dessas
                            transferências está em outra conta bancária. Nenhuma outra conta pode ser alterada sem sua
                            autorização expressa.
                          </p>
                        </div>
                      </div>

                      {/* Tabela de impacto nas outras contas */}
                      <div className="bg-white rounded-lg border border-amber-200 overflow-hidden mt-2">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-amber-100/70 text-amber-900 font-semibold border-b border-amber-200">
                            <tr>
                              <th className="px-3 py-2">Outra Conta</th>
                              <th className="px-3 py-2 text-center">Transf.</th>
                              <th className="px-3 py-2 text-right">Saldo Atual</th>
                              <th className="px-3 py-2 text-right">Saldo Depois</th>
                              <th className="px-3 py-2 text-right">Impacto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {dryRun.outras_contas_afetadas.map((oc) => (
                              <tr key={oc.conta_id} className="hover:bg-amber-50/50">
                                <td className="px-3 py-2 font-medium text-slate-800">{oc.conta_nome}</td>
                                <td className="px-3 py-2 text-center font-num">{oc.quantidade_transferencias}</td>
                                <td className="px-3 py-2 text-right font-num">{moeda(oc.saldo_antes)}</td>
                                <td className="px-3 py-2 text-right font-num font-semibold text-slate-800">
                                  {moeda(oc.saldo_depois)}
                                </td>
                                <td
                                  className={`px-3 py-2 text-right font-num font-bold ${
                                    oc.diferenca < 0
                                      ? 'text-red-600'
                                      : oc.diferenca > 0
                                      ? 'text-emerald-600'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {oc.diferenca > 0 ? `+${moeda(oc.diferenca)}` : moeda(oc.diferenca)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Opção explícita para desbloquear */}
                    <label className="flex items-start gap-3 p-3 bg-red-50/70 border-2 border-red-300 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={excluirContrapartidas}
                        onChange={(e) => setExcluirContrapartidas(e.target.checked)}
                        className="mt-0.5 text-red-600 focus:ring-red-600 rounded"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-red-900 block">
                          Excluir também as contrapartidas das transferências (isto altera o saldo das outras contas)
                        </span>
                        <span className="text-red-700 text-[11px] block mt-0.5">
                          Contas afetadas:{' '}
                          {dryRun.outras_contas_afetadas
                            .map((oc) => `${oc.conta_nome} (${oc.diferenca >= 0 ? '+' : ''}${moeda(oc.diferenca)})`)
                            .join(', ')}
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </section>

              {/* Seção 5: Confirmação Obrigatória com Digitação do Nome */}
              <section className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Para confirmar a exclusão definitiva, digite o nome exato da conta:{' '}
                  <span className="text-red-700 underline font-extrabold select-all">{conta.nome}</span>
                </label>
                <input
                  type="text"
                  value={textoConfirmacao}
                  onChange={(e) => setTextoConfirmacao(e.target.value)}
                  placeholder={`Digite "${conta.nome}"`}
                  className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 transition-all ${
                    nomeConfere
                      ? 'border-emerald-500 focus:ring-emerald-500 text-emerald-900'
                      : 'border-slate-300 focus:ring-red-500 text-slate-800'
                  }`}
                />
                {textoConfirmacao.trim().length > 0 && (
                  <p className={`text-[11px] font-medium ${nomeConfere ? 'text-emerald-600' : 'text-red-600'}`}>
                    {nomeConfere ? '✓ Nome da conta confere.' : '✗ O nome digitado não confere exatamente com a conta.'}
                  </p>
                )}
              </section>
            </>
          )}

          {/* RESULTADO DE SUCESSO */}
          {etapa === 'resultado' && resultado && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 space-y-1">
                  <p className="font-bold text-sm">Conta e Histórico Excluídos com Sucesso!</p>
                  <p>{resultado.mensagem}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-slate-500 font-medium">Lançamentos da Conta</p>
                  <p className="font-bold text-slate-800 text-base font-num">
                    {resultado.total_lancamentos_excluidos} excluídos
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-slate-500 font-medium">Contrapartidas</p>
                  <p className="font-bold text-slate-800 text-base font-num">
                    {resultado.total_contrapartidas_excluidas} excluídas
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-slate-500 font-medium">Lotes de Importação</p>
                  <p className="font-bold text-slate-800 text-base font-num">
                    {resultado.total_lotes_excluidos} excluídos
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-slate-500 font-medium">Regras de Importação</p>
                  <p className="font-bold text-slate-800 text-base font-num">
                    {resultado.total_regras_excluidas} excluídas
                  </p>
                </div>
              </div>

              {resultado.registros_folha_desvinculados > 0 && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900">
                  <span className="font-bold">Folha de pagamento:</span>{' '}
                  {resultado.registros_folha_desvinculados} registro(s) da folha foram desvinculados com sucesso e
                  mantidos preservados para quitação futura.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé / Ações */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-2xl shrink-0">
          {etapa === 'resultado' ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onFechar}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer transition-colors"
              >
                Concluir e Fechar
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={etapa === 'executando'}
                onClick={onFechar}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={!podeExcluir}
                onClick={handleConfirmarExclusao}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl shadow-xs cursor-pointer flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Backup e Excluir Definitivamente</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

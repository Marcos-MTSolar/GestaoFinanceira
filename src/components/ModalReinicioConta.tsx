import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Loader2,
  Trash2,
  Lock,
  Info,
} from 'lucide-react';
import { dbService } from '../services/storage';
import { ContaBancaria, DryRunReinicioConta, ResultadoReinicioConta } from '../types';

// Utilitário de formatação de moeda
function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Props {
  conta: ContaBancaria;
  onFechar: () => void;
}

type Etapa = 'simulando' | 'revisao' | 'confirmacao' | 'executando' | 'resultado';

export const ModalReinicioConta: React.FC<Props> = ({ conta, onFechar }) => {
  const [etapa, setEtapa] = useState<Etapa>('simulando');

  // Opções
  const [zerarSaldoInicial, setZerarSaldoInicial] = useState(false);
  const [novaDataSaldoInicial, setNovaDataSaldoInicial] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Resultados
  const [dryRun, setDryRun] = useState<DryRunReinicioConta | null>(null);
  const [resultado, setResultado] = useState<ResultadoReinicioConta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Campo de confirmação
  const [textoConfirmacao, setTextoConfirmacao] = useState('');

  // Executa simulação assim que o modal abre
  useEffect(() => {
    executarSimulacao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zerarSaldoInicial, novaDataSaldoInicial]);

  function executarSimulacao() {
    setEtapa('simulando');
    setErro(null);
    try {
      const resultado = dbService.simularReinicioConta({
        contaId: conta.id,
        zerarSaldoInicial,
        novaDataSaldoInicial: zerarSaldoInicial ? novaDataSaldoInicial : undefined,
      });
      setDryRun(resultado);
      setEtapa('revisao');
    } catch (e: any) {
      setErro(e?.message || 'Erro ao simular.');
      setEtapa('revisao');
    }
  }

  async function handleExecutar() {
    if (!dryRun) return;
    setEtapa('executando');
    setErro(null);
    try {
      const res = await dbService.executarReinicioConta({
        contaId: conta.id,
        zerarSaldoInicial,
        novaDataSaldoInicial: zerarSaldoInicial ? novaDataSaldoInicial : undefined,
      });
      setResultado(res);
      setEtapa('resultado');
    } catch (e: any) {
      setErro(e?.message || 'Erro ao executar reinício.');
      setEtapa('revisao');
    }
  }

  const nomeConfirmacaoOK = textoConfirmacao.trim() === conta.nome.trim();
  const podeProsseguir = nomeConfirmacaoOK && dryRun !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 bg-red-700 text-white rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-red-200" />
            <div>
              <h2 className="font-bold text-base leading-tight">Preparar para Reimportar Extrato</h2>
              <p className="text-xs text-red-200 mt-0.5">{conta.nome}</p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="text-red-200 hover:text-white transition-colors cursor-pointer"
            title="Fechar"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ─── SIMULANDO ─── */}
          {etapa === 'simulando' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-[#003064]" />
              <p className="text-sm">Analisando dados da conta…</p>
            </div>
          )}

          {/* ─── EXECUTANDO ─── */}
          {etapa === 'executando' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
              <p className="text-sm font-semibold text-red-700">Gerando backup e removendo lançamentos…</p>
              <p className="text-xs text-slate-500">Não feche esta janela.</p>
            </div>
          )}

          {/* ─── ERRO ─── */}
          {erro && (
            <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p>{erro}</p>
            </div>
          )}

          {/* ─── REVISÃO (DRY-RUN) ─── */}
          {(etapa === 'revisao' || etapa === 'confirmacao') && dryRun && (
            <>
              {/* Aviso de severidade */}
              <div className="p-4 bg-red-50 border border-red-300 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-900 space-y-1">
                  <p className="font-bold">Esta ação é irreversível sem o backup gerado automaticamente.</p>
                  <p>
                    Apaga <strong>somente</strong> lançamentos vindos de importação de extrato.
                    Lançamentos manuais, folha de pagamento e contas a pagar/receber
                    <strong> serão preservados</strong>.
                  </p>
                </div>
              </div>

              {/* Resumo: O que será REMOVIDO */}
              <section>
                <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Será removido
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-slate-500">Lançamentos de importação</p>
                    <p className="font-bold text-red-700 text-base font-num">
                      {dryRun.total_lancamentos_removidos}
                    </p>
                  </div>
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                    <p className="text-slate-500">Transferências geradas</p>
                    <p className="font-bold text-orange-700 text-base font-num">
                      {dryRun.total_transferencias_removidas}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-slate-500">Lotes de importação</p>
                    <p className="font-bold text-amber-700 text-base font-num">
                      {dryRun.total_lotes_afetados}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <p className="text-slate-500">Ajustes de conciliação</p>
                    <p className="font-bold text-yellow-700 text-base font-num">
                      {dryRun.total_ajustes_removidos}
                    </p>
                  </div>
                </div>
              </section>

              {/* Resumo: O que será PRESERVADO */}
              <section>
                <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Será preservado
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-slate-500">Manuais</p>
                    <p className="font-bold text-emerald-700 text-base font-num">{dryRun.preservados.manuais}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-slate-500">Folha de pagamento</p>
                    <p className="font-bold text-emerald-700 text-base font-num">{dryRun.preservados.folha}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-slate-500">Contas a pagar/receber</p>
                    <p className="font-bold text-emerald-700 text-base font-num">{dryRun.preservados.contas_pagar_receber}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-slate-500">Transferências manuais</p>
                    <p className="font-bold text-emerald-700 text-base font-num">{dryRun.preservados.transferencias_manuais}</p>
                  </div>
                </div>
              </section>

              {/* Saldos antes/depois */}
              <section>
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" /> Impacto nos saldos
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600">
                        <th className="px-3 py-2 text-left font-semibold">Conta</th>
                        <th className="px-3 py-2 text-right font-semibold">Saldo Antes</th>
                        <th className="px-3 py-2 text-right font-semibold">Saldo Depois</th>
                        <th className="px-3 py-2 text-right font-semibold">Diferença</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Conta principal */}
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2 font-semibold text-[#003064]">{dryRun.conta_nome}</td>
                        <td className="px-3 py-2 text-right font-num text-slate-700">{moeda(dryRun.saldo_antes)}</td>
                        <td className="px-3 py-2 text-right font-num text-slate-700">{moeda(dryRun.saldo_depois)}</td>
                        <td className={`px-3 py-2 text-right font-num font-bold ${
                          dryRun.saldo_depois - dryRun.saldo_antes < 0 ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {moeda(dryRun.saldo_depois - dryRun.saldo_antes)}
                        </td>
                      </tr>
                      {/* Contas secundárias afetadas */}
                      {dryRun.contas_afetadas.map((ca) => (
                        <tr key={ca.conta_id} className="border-b border-slate-100 bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-600">{ca.conta_nome}</td>
                          <td className="px-3 py-2 text-right font-num text-slate-600">{moeda(ca.saldo_antes)}</td>
                          <td className="px-3 py-2 text-right font-num text-slate-600">{moeda(ca.saldo_depois)}</td>
                          <td className={`px-3 py-2 text-right font-num font-semibold ${
                            ca.diferenca < 0 ? 'text-red-500' : 'text-emerald-500'
                          }`}>
                            {moeda(ca.diferenca)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Opção: Zerar saldo inicial */}
              <section className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={zerarSaldoInicial}
                    onChange={(e) => setZerarSaldoInicial(e.target.checked)}
                    className="w-4 h-4 rounded accent-red-600"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Zerar também o saldo inicial da conta
                    <span className="ml-1 text-slate-400 font-normal">(padrão: desmarcado)</span>
                  </span>
                </label>

                {zerarSaldoInicial && (
                  <div className="flex items-center gap-3 pl-7">
                    <label className="text-xs text-slate-600 shrink-0">Nova data do saldo inicial:</label>
                    <input
                      type="date"
                      value={novaDataSaldoInicial}
                      onChange={(e) => setNovaDataSaldoInicial(e.target.value)}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                )}

                <p className="text-[11px] text-slate-500 pl-7">
                  Saldo inicial atual: <span className="font-semibold font-num">{moeda(dryRun.saldo_inicial_atual)}</span>
                  {zerarSaldoInicial && (
                    <> → <span className="font-semibold text-red-600 font-num">{moeda(0)}</span></>
                  )}
                </p>
              </section>

              {/* ─── CONFIRMAÇÃO ─── */}
              {etapa === 'confirmacao' && (
                <section className="p-4 bg-red-50 border-2 border-red-400 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-red-800">
                    ⚠️ Confirmação obrigatória: Digite o nome exato da conta para prosseguir.
                  </p>
                  <p className="text-xs text-red-700">
                    Digite: <strong>{conta.nome}</strong>
                  </p>
                  <input
                    type="text"
                    value={textoConfirmacao}
                    onChange={(e) => setTextoConfirmacao(e.target.value)}
                    placeholder="Nome da conta..."
                    className="w-full border-2 border-red-300 rounded-xl px-4 py-2 text-sm text-red-900 font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-red-300"
                    autoFocus
                  />
                  {textoConfirmacao && !nomeConfirmacaoOK && (
                    <p className="text-[11px] text-red-600">
                      Nome incorreto. Certifique-se de digitar exatamente: "{conta.nome}"
                    </p>
                  )}
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2">
                    <Download className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-800">
                      O backup completo será <strong>baixado automaticamente</strong> antes de qualquer remoção.
                      Aguarde o download antes de fechar o navegador.
                    </p>
                  </div>
                </section>
              )}
            </>
          )}

          {/* ─── RESULTADO ─── */}
          {etapa === 'resultado' && resultado && (
            <div className="space-y-5">
              <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-800 text-sm">Reinício concluído com sucesso!</p>
                  <p className="text-xs text-emerald-700 mt-1">{resultado.mensagem}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-slate-500">Removidos</p>
                  <p className="font-bold text-red-600 text-lg font-num">{resultado.removidos}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-slate-500">Lotes desfeitos</p>
                  <p className="font-bold text-amber-600 text-lg font-num">{resultado.lotes_desfeitos}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-slate-500">Backup gerado</p>
                  <p className="font-bold text-emerald-600 text-sm mt-1">✓</p>
                </div>
              </div>

              {/* Saldos finais */}
              <section>
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Saldos finais após limpeza
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600">
                        <th className="px-3 py-2 text-left font-semibold">Conta</th>
                        <th className="px-3 py-2 text-right font-semibold">Saldo Real</th>
                        <th className="px-3 py-2 text-right font-semibold">Limite</th>
                        <th className="px-3 py-2 text-right font-semibold">Cheque Utilizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.saldos_finais.map((sf) => (
                        <tr key={sf.conta_id} className="border-b border-slate-100">
                          <td className="px-3 py-2 font-semibold text-[#003064]">{sf.conta_nome}</td>
                          <td className={`px-3 py-2 text-right font-num font-bold ${sf.saldo_real < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {moeda(sf.saldo_real)}
                          </td>
                          <td className="px-3 py-2 text-right font-num text-slate-600">{moeda(sf.limite_credito)}</td>
                          <td className="px-3 py-2 text-right font-num text-orange-600">{moeda(sf.cheque_utilizado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <p className="text-[11px] text-slate-500 text-center">
                A conta está pronta para uma nova importação de extrato.
              </p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onFechar}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {etapa === 'resultado' ? 'Fechar' : 'Cancelar'}
          </button>

          <div className="flex items-center gap-2">
            {/* Botão re-simular */}
            {(etapa === 'revisao') && (
              <button
                onClick={executarSimulacao}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-simular
              </button>
            )}

            {/* Avançar para confirmação */}
            {etapa === 'revisao' && dryRun && (
              <button
                onClick={() => setEtapa('confirmacao')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
              >
                Prosseguir
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Executar (requer confirmação) */}
            {etapa === 'confirmacao' && (
              <button
                onClick={handleExecutar}
                disabled={!podeProsseguir}
                title={!podeProsseguir ? 'Digite o nome exato da conta para confirmar' : ''}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
                  podeProsseguir
                    ? 'text-white bg-red-700 hover:bg-red-800 cursor-pointer'
                    : 'text-red-300 bg-red-100 cursor-not-allowed'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                Fazer backup e executar limpeza
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

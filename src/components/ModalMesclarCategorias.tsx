import React, { useState, useEffect } from 'react';
import {
  Layers,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  Database,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import { dbService } from '../services/storage';
import { DryRunMesclarCategorias, ResultadoMesclarCategorias } from '../types';

interface Props {
  isOpen: boolean;
  onFechar: () => void;
}

type Etapa = 'simulando' | 'confirmacao' | 'executando' | 'resultado';

export const ModalMesclarCategorias: React.FC<Props> = ({ isOpen, onFechar }) => {
  // Hooks sempre no topo absoluto
  const [etapa, setEtapa] = useState<Etapa>('simulando');
  const [dryRun, setDryRun] = useState<DryRunMesclarCategorias | null>(null);
  const [resultado, setResultado] = useState<ResultadoMesclarCategorias | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [textoConfirmacao, setTextoConfirmacao] = useState('');

  useEffect(() => {
    if (isOpen) {
      executarSimulacao();
    } else {
      setEtapa('simulando');
      setTextoConfirmacao('');
      setDryRun(null);
      setResultado(null);
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function executarSimulacao() {
    setEtapa('simulando');
    setErro(null);
    try {
      const res = dbService.simularMesclagemCategorias();
      setDryRun(res);
      setEtapa('confirmacao');
    } catch (e: any) {
      setErro(e?.message || 'Erro ao simular mesclagem de categorias.');
      setEtapa('confirmacao');
    }
  }

  async function handleConfirmarMesclagem() {
    if (!dryRun) return;
    setEtapa('executando');
    setErro(null);

    try {
      const res = await dbService.mesclarCategoriasDuplicadas({
        textoConfirmacao,
      });
      setResultado(res);
      setEtapa('resultado');
    } catch (e: any) {
      setErro(e?.message || 'Erro ao executar a mesclagem de categorias.');
      setEtapa('confirmacao');
    }
  }

  if (!isOpen) return null;

  const textoConfere = textoConfirmacao.trim().toUpperCase() === 'MESCLAR';
  const podeConfirmar =
    textoConfere && dryRun !== null && dryRun.tem_duplicadas_para_mesclar && etapa === 'confirmacao';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003064]/10 text-[#003064] flex items-center justify-center">
              <Layers className="w-5 h-5 text-[#003064]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 font-serif">
                Consolidação & Mesclagem de Categorias
              </h2>
              <p className="text-xs text-slate-500">
                Elimina categorias duplicadas, reaponta vínculos e consolida o plano de contas
              </p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 transition-colors cursor-pointer"
            disabled={etapa === 'executando'}
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-700">
          {erro && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Ocorreu uma falha:</p>
                <p>{erro}</p>
              </div>
            </div>
          )}

          {/* ETAPA: SIMULANDO */}
          {etapa === 'simulando' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#003064] animate-spin" />
              <p className="text-xs font-semibold text-slate-600 font-serif">
                Mapeando categorias e calculando referências vinculadas...
              </p>
            </div>
          )}

          {/* ETAPA: EXECUTANDO */}
          {etapa === 'executando' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#003064] animate-spin" />
              <p className="text-sm font-bold text-slate-800 font-serif">
                Executando mesclagem em lotes atômicos...
              </p>
              <p className="text-xs text-slate-500 text-center max-w-md">
                Gerando backup JSON de segurança, reapontando lançamentos, recorrências e regras de importação,
                e removendo duplicadas com integridade absoluta.
              </p>
            </div>
          )}

          {/* ETAPA: RESULTADO */}
          {etapa === 'resultado' && resultado && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-start gap-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-bold text-sm font-serif">Mesclagem Concluída com Sucesso!</h3>
                  <p className="text-xs text-emerald-800">{resultado.mensagem}</p>
                </div>
              </div>

              {/* Cards de Métricas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col">
                  <span className="text-[11px] font-semibold text-slate-500">Categorias Mescladas</span>
                  <span className="text-xl font-bold text-[#003064] font-num">
                    {resultado.total_categorias_mescladas}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col">
                  <span className="text-[11px] font-semibold text-slate-500">Lançamentos Reapontados</span>
                  <span className="text-xl font-bold text-slate-800 font-num">
                    {resultado.total_lancamentos_reapontados}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col">
                  <span className="text-[11px] font-semibold text-slate-500">Recorrências Reapontadas</span>
                  <span className="text-xl font-bold text-slate-800 font-num">
                    {resultado.total_recorrencias_reapontadas}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col">
                  <span className="text-[11px] font-semibold text-slate-500">Regras de Importação</span>
                  <span className="text-xl font-bold text-slate-800 font-num">
                    {resultado.total_regras_reapontadas}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 flex items-center gap-3">
                <Database className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-xs">
                  O backup completo de segurança foi baixado automaticamente no seu navegador. Os relatórios de
                  DRE e fluxo de caixa permanecem 100% íntegros.
                </p>
              </div>
            </div>
          )}

          {/* ETAPA: CONFIRMAÇÃO (DRY RUN) */}
          {etapa === 'confirmacao' && dryRun && (
            <div className="space-y-6">
              {/* Resumo Geral */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-[11px] font-semibold text-slate-500 block">Grupos com Duplicatas</span>
                  <span className="text-2xl font-bold text-[#003064] font-num">
                    {dryRun.total_grupos_duplicados}
                  </span>
                </div>
                <div className="p-4 rounded-xl border border-red-200 bg-red-50/50">
                  <span className="text-[11px] font-semibold text-red-600 block">Categorias Excedentes</span>
                  <span className="text-2xl font-bold text-red-700 font-num">
                    {dryRun.total_categorias_duplicadas}
                  </span>
                </div>
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                  <span className="text-[11px] font-semibold text-amber-700 block">Vínculos a Reapontar</span>
                  <span className="text-2xl font-bold text-amber-800 font-num">
                    {dryRun.total_referencias_afetadas}
                  </span>
                </div>
              </div>

              {!dryRun.tem_duplicadas_para_mesclar ? (
                <div className="p-6 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h3 className="font-bold text-sm font-serif">Plano de Contas Consolidado!</h3>
                  <p className="text-xs text-emerald-800 max-w-md mx-auto">
                    Não há nenhuma categoria duplicada na base de dados. Cada nome e tipo possui apenas uma
                    única categoria ativa e canônica.
                  </p>
                </div>
              ) : (
                <>
                  {/* Lista de Grupos */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Detalhamento dos Grupos Duplicados Detectados:
                    </h3>

                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {dryRun.grupos.map((grupo) => (
                        <div
                          key={grupo.chave}
                          className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-800 font-serif">
                                {grupo.nomeNormalizado}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  grupo.tipo === 'receita'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {grupo.tipo}
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-num">
                              {grupo.totalReferencias} vínculo(s) afetado(s)
                            </span>
                          </div>

                          {/* Canônica */}
                          <div className="flex items-center justify-between text-xs bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200/80">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: grupo.canonica.cor }}
                              />
                              <span className="font-bold text-emerald-950">{grupo.canonica.nome}</span>
                              <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded font-mono">
                                {grupo.canonica.id}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                              ★ Canônica Escolhida
                            </span>
                          </div>

                          {/* Duplicadas que serão mescladas */}
                          <div className="space-y-1.5 pl-3 border-l-2 border-red-200">
                            <span className="text-[10px] font-bold text-red-600 block uppercase">
                              Categorias que serão mescladas e removidas:
                            </span>
                            {grupo.duplicadas.map((dup) => (
                              <div
                                key={dup.id}
                                className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded-md"
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: dup.cor }}
                                  />
                                  <span>{dup.nome}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">({dup.id})</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <span className="text-[10px]">Reaponta para a canônica</span>
                                  <ArrowRight className="w-3 h-3 text-emerald-600" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Alerta de Segurança e Confirmação */}
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 space-y-3">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-900 space-y-1">
                        <p className="font-bold">Ação Crítica de Consolidação de Dados</p>
                        <p>
                          Antes da gravação, um backup JSON completo será gerado e baixado automaticamente.
                          Todos os lançamentos, regras e recorrências que utilizavam as categorias excedentes
                          passarão a apontar para a categoria canônica eleita.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-200/60">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Para prosseguir, digite <span className="font-mono text-red-600">MESCLAR</span> no campo abaixo:
                      </label>
                      <input
                        type="text"
                        value={textoConfirmacao}
                        onChange={(e) => setTextoConfirmacao(e.target.value)}
                        placeholder="Digite MESCLAR para confirmar"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold uppercase tracking-wider focus:ring-2 focus:ring-[#003064] focus:border-[#003064] outline-hidden bg-white"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onFechar}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
            disabled={etapa === 'executando'}
          >
            {etapa === 'resultado' ? 'Fechar' : 'Cancelar'}
          </button>

          {etapa === 'confirmacao' && dryRun && dryRun.tem_duplicadas_para_mesclar && (
            <button
              onClick={handleConfirmarMesclagem}
              disabled={!podeConfirmar}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2 ${
                podeConfirmar
                  ? 'bg-[#003064] hover:bg-[#00204A] cursor-pointer shadow-xs border-b-2 border-[#FCBC00]'
                  : 'bg-slate-300 cursor-not-allowed opacity-60'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#FCBC00]" />
              <span>Executar Mesclagem Definitiva</span>
            </button>
          )}

          {etapa === 'resultado' && (
            <button
              onClick={onFechar}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#003064] hover:bg-[#00204A] transition-all cursor-pointer shadow-xs border-b-2 border-[#FCBC00]"
            >
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


import React, { useState, useEffect, useMemo } from 'react';
import {
  RegistroImportacao,
  ContaBancaria
} from '../../types';
import { dbService, subscribe } from '../../services/storage';
import { usePrivacy } from '../../context/PrivacyContext';
import {
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Search,
  Calendar,
  Building,
  User,
  ExternalLink,
  UploadCloud,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Filter
} from 'lucide-react';
import { Modal } from '../Modal';
import { BANCOS_REGISTRADOS } from '../../utils/extrato';

interface HistoricoImportacoesProps {
  contas: ContaBancaria[];
  onNovaImportacao?: () => void;
  onVerLote?: (loteId: string) => void;
}

export const HistoricoImportacoes: React.FC<HistoricoImportacoesProps> = ({
  contas,
  onNovaImportacao,
  onVerLote,
}) => {
  const { ocultarValores } = usePrivacy();

  const [importacoes, setImportacoes] = useState<RegistroImportacao[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'concluida' | 'parcial' | 'desfeita'>('todos');
  const [filtroConta, setFiltroConta] = useState<string>('todas');

  // Estado para confirmação de desfazimento
  const [loteParaDesfazer, setLoteParaDesfazer] = useState<RegistroImportacao | null>(null);
  const [desfazendo, setDesfazendo] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const carregar = () => {
    setImportacoes(dbService.getImportacoes());
  };

  useEffect(() => {
    carregar();
    const unsub = subscribe('importacoes', carregar);
    return () => unsub();
  }, []);

  const formatarValor = (val?: number) => {
    if (val === undefined || isNaN(val)) return 'R$ 0,00';
    if (ocultarValores) return '••••••';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarDataBR = (dataIso?: string) => {
    if (!dataIso) return '-';
    const partes = dataIso.split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return dataIso;
  };

  const mapaContas = useMemo(() => {
    const mapa = new Map<string, ContaBancaria>();
    for (const c of contas) mapa.set(c.id, c);
    return mapa;
  }, [contas]);

  const obterNomeBanco = (codigo?: string) => {
    if (!codigo) return 'Banco';
    const b = BANCOS_REGISTRADOS.find((item) => item.codigo === codigo);
    return b?.nome || `Banco ${codigo}`;
  };

  // Filtragem da lista
  const importacoesFiltradas = useMemo(() => {
    return importacoes.filter((imp) => {
      if (filtroStatus !== 'todos' && imp.status !== filtroStatus) return false;
      if (filtroConta !== 'todas' && imp.conta_id !== filtroConta) return false;

      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const nomeConta = mapaContas.get(imp.conta_id)?.nome.toLowerCase() || '';
        const nomeArq = (imp.nome_arquivo || '').toLowerCase();
        const usuario = (imp.usuario || '').toLowerCase();
        const loteId = (imp.id || '').toLowerCase();
        if (
          !nomeConta.includes(termo) &&
          !nomeArq.includes(termo) &&
          !usuario.includes(termo) &&
          !loteId.includes(termo)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [importacoes, filtroStatus, filtroConta, busca, mapaContas]);

  // Totais estatísticos consolidados
  const estatisticas = useMemo(() => {
    let totalLotes = importacoes.length;
    let concluidas = 0;
    let desfeitas = 0;
    let totalLancados = 0;

    for (const imp of importacoes) {
      if (imp.status === 'concluida') {
        concluidas++;
        totalLancados += imp.totais?.lancadas || 0;
      } else if (imp.status === 'desfeita') {
        desfeitas++;
      }
    }

    return { totalLotes, concluidas, desfeitas, totalLancados };
  }, [importacoes]);

  // Ação de Desfazer Importação
  const handleConfirmarDesfazer = async () => {
    if (!loteParaDesfazer) return;
    setDesfazendo(true);
    setMensagemErro(null);

    try {
      const res = await dbService.desfazerImportacao(loteParaDesfazer.id);
      setMensagemSucesso(res.mensagem || 'Lote desfeito com sucesso!');
      setLoteParaDesfazer(null);
      carregar();
      setTimeout(() => setMensagemSucesso(null), 6000);
    } catch (err: any) {
      setMensagemErro(err?.message || 'Falha ao desfazer a importação.');
    } finally {
      setDesfazendo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mensagens de Feedback */}
      {mensagemSucesso && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-900 flex items-center gap-3 shadow-xs animate-in fade-in"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{mensagemSucesso}</span>
        </div>
      )}

      {mensagemErro && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs text-rose-900 flex items-center gap-3 shadow-xs animate-in shake"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-semibold">{mensagemErro}</span>
        </div>
      )}

      {/* Cartões de Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Lotes Importados</p>
          <p className="text-xl font-bold font-num text-[#003064] mt-1">{estatisticas.totalLotes}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Histórico completo</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">Concluídos</p>
          <p className="text-xl font-bold font-num text-emerald-700 mt-1">{estatisticas.concluidas}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Em vigor no saldo</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-[#1A4A85] uppercase tracking-wide">Lançamentos Criados</p>
          <p className="text-xl font-bold font-num text-[#1A4A85] mt-1">{estatisticas.totalLancados}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Total conciliado</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Lotes Desfeitos</p>
          <p className="text-xl font-bold font-num text-slate-700 mt-1">{estatisticas.desfeitas}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Rollbacks executados</p>
        </div>
      </div>

      {/* Barra de Filtros e Ação */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por arquivo, conta, usuário ou lote..."
              aria-label="Buscar histórico de importações"
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as any)}
                aria-label="Filtrar por status"
                className="text-xs bg-transparent border-none text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="todos">Todos os status</option>
                <option value="concluida">Concluídas</option>
                <option value="parcial">Parciais</option>
                <option value="desfeita">Desfeitas</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filtroConta}
                onChange={(e) => setFiltroConta(e.target.value)}
                aria-label="Filtrar por conta bancária"
                className="text-xs bg-transparent border-none text-slate-700 focus:outline-hidden cursor-pointer max-w-[160px] truncate"
              >
                <option value="todas">Todas as contas</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {onNovaImportacao && (
              <button
                type="button"
                onClick={onNovaImportacao}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#003064] hover:bg-[#00204A] text-white text-xs font-semibold rounded-xl shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-[#FCBC00]" />
                <span>Nova Importação</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Importações */}
      {importacoesFiltradas.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 text-center shadow-xs">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">Nenhuma importação encontrada</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {busca || filtroStatus !== 'todos' || filtroConta !== 'todas'
              ? 'Tente ajustar os filtros ou a busca para localizar o lote desejado.'
              : 'Você ainda não importou nenhum extrato bancário. Use o botão acima para importar arquivos OFX, QFX ou planilhas Santander.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Tabela Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-semibold">
                  <th className="py-3 px-4">Data / Lote</th>
                  <th className="py-3 px-4">Banco & Conta</th>
                  <th className="py-3 px-4">Arquivo</th>
                  <th className="py-3 px-4">Período</th>
                  <th className="py-3 px-4 text-right">Créditos</th>
                  <th className="py-3 px-4 text-right">Débitos</th>
                  <th className="py-3 px-4 text-center">Totais</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importacoesFiltradas.map((imp) => {
                  const conta = mapaContas.get(imp.conta_id);
                  const nomeBanco = obterNomeBanco(imp.banco_codigo);
                  const foiDesfeita = imp.status === 'desfeita';

                  return (
                    <tr
                      key={imp.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        foiDesfeita ? 'opacity-60 bg-slate-50/30' : ''
                      }`}
                    >
                      {/* Data / Lote */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{formatarDataBR(imp.data)}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5" title={imp.id}>
                          {imp.id.slice(0, 18)}...
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[120px]">{imp.usuario || 'Usuário'}</span>
                        </div>
                      </td>

                      {/* Banco & Conta */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-[#003064]">
                          {conta?.nome || 'Conta não encontrada'}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span className="font-medium">{nomeBanco}</span>
                          {imp.banco_codigo && (
                            <span className="bg-slate-100 text-slate-600 px-1 rounded-xs font-mono text-[9px]">
                              {imp.banco_codigo}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Arquivo & Formato */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 max-w-[200px] truncate" title={imp.nome_arquivo}>
                          {imp.formato === 'xlsx' ? (
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-[#003064] shrink-0" />
                          )}
                          <span className="truncate">{imp.nome_arquivo}</span>
                        </div>
                        <span className="inline-block mt-0.5 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-sm">
                          {imp.formato}
                        </span>
                      </td>

                      {/* Período */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatarDataBR(imp.periodo?.inicio)} a {formatarDataBR(imp.periodo?.fim)}</span>
                        </div>
                      </td>

                      {/* Créditos */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-num font-semibold text-emerald-700">
                        +{formatarValor(imp.totais?.total_creditos)}
                      </td>

                      {/* Débitos */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-num font-semibold text-rose-600">
                        -{formatarValor(imp.totais?.total_debitos)}
                      </td>

                      {/* Totais detalhados */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-[#003064] rounded-lg font-num font-bold text-[11px]">
                          {imp.totais?.lancadas || 0} lançadas
                        </span>
                        {(imp.totais?.enriquecidas || 0) > 0 && (
                          <div className="text-[10px] text-purple-700 mt-0.5 font-medium">
                            +{imp.totais.enriquecidas} enriquecidas
                          </div>
                        )}
                        {(imp.totais?.duplicadas || 0) > 0 && (
                          <div className="text-[10px] text-amber-700 mt-0.5 font-medium">
                            {imp.totais.duplicadas} duplicadas
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {imp.status === 'concluida' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Concluída
                          </span>
                        )}
                        {imp.status === 'parcial' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            Parcial
                          </span>
                        )}
                        {imp.status === 'desfeita' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-full line-through">
                            <RotateCcw className="w-3 h-3" />
                            Desfeita
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {onVerLote && (
                            <button
                              type="button"
                              onClick={() => onVerLote(imp.id)}
                              className="p-1.5 text-slate-500 hover:text-[#003064] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Ver lançamentos deste lote"
                              aria-label="Ver lançamentos deste lote"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}

                          {!foiDesfeita && (
                            <button
                              type="button"
                              onClick={() => setLoteParaDesfazer(imp)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] rounded-lg transition-colors cursor-pointer border border-rose-200"
                              title="Desfazer e reverter esta importação"
                              aria-label={`Desfazer importação do arquivo ${imp.nome_arquivo}`}
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Desfazer</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards Mobile / Tablet */}
          <div className="lg:hidden divide-y divide-slate-100">
            {importacoesFiltradas.map((imp) => {
              const conta = mapaContas.get(imp.conta_id);
              const nomeBanco = obterNomeBanco(imp.banco_codigo);
              const foiDesfeita = imp.status === 'desfeita';

              return (
                <div
                  key={imp.id}
                  className={`p-4 space-y-3 ${foiDesfeita ? 'opacity-60 bg-slate-50/50' : 'bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {imp.formato === 'xlsx' ? (
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <FileText className="w-4 h-4 text-[#003064]" />
                        )}
                        <span className="font-bold text-xs text-slate-900 break-all">{imp.nome_arquivo}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {conta?.nome || 'Conta'} • {nomeBanco}
                      </p>
                    </div>

                    <div>
                      {imp.status === 'concluida' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                          Concluída
                        </span>
                      )}
                      {imp.status === 'parcial' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                          Parcial
                        </span>
                      )}
                      {imp.status === 'desfeita' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-full line-through">
                          Desfeita
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Data da Importação</span>
                      <span className="font-semibold text-slate-800">{formatarDataBR(imp.data)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Período</span>
                      <span className="text-slate-700 text-[11px]">
                        {formatarDataBR(imp.periodo?.inicio)} - {formatarDataBR(imp.periodo?.fim)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Créditos</span>
                      <span className="font-bold font-num text-emerald-700">
                        +{formatarValor(imp.totais?.total_creditos)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Débitos</span>
                      <span className="font-bold font-num text-rose-600">
                        -{formatarValor(imp.totais?.total_debitos)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[11px] font-bold text-[#003064]">
                      {imp.totais?.lancadas || 0} lançamentos
                    </span>

                    <div className="flex items-center gap-2">
                      {onVerLote && (
                        <button
                          type="button"
                          onClick={() => onVerLote(imp.id)}
                          className="px-2.5 py-1 text-slate-600 hover:text-[#003064] text-xs font-semibold"
                        >
                          Ver
                        </button>
                      )}

                      {!foiDesfeita && (
                        <button
                          type="button"
                          onClick={() => setLoteParaDesfazer(imp)}
                          className="flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-700 rounded-lg font-semibold text-xs border border-rose-200"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Desfazer</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE DESFAZIMENTO */}
      <Modal
        isOpen={!!loteParaDesfazer}
        onClose={() => {
          if (!desfazendo) setLoteParaDesfazer(null);
        }}
        title="Desfazer Lote de Importação"
        maxWidth="md"
      >
        {loteParaDesfazer && (
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-950 space-y-1">
                <p className="font-bold text-rose-900">Atenção: Ação de Reversão de Dados</p>
                <p>
                  Você está prestes a desfazer o lote de importação do arquivo{' '}
                  <strong>{loteParaDesfazer.nome_arquivo}</strong>.
                </p>
                <ul className="list-disc pl-4 mt-2 space-y-0.5 text-rose-900">
                  <li>
                    <strong>{loteParaDesfazer.totais?.lancadas || 0} lançamentos</strong> criados por este lote serão
                    definitivamente excluídos.
                  </li>
                  {(loteParaDesfazer.snapshot_enriquecidos?.length || 0) > 0 && (
                    <li>
                      <strong>{loteParaDesfazer.snapshot_enriquecidos?.length} lançamentos enriquecidos</strong>{' '}
                      terão suas descrições e vínculos anteriores restaurados.
                    </li>
                  )}
                  <li>
                    O saldo da conta <strong>{mapaContas.get(loteParaDesfazer.conta_id)?.nome}</strong> será
                    recalculado automaticamente.
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5 font-num">
              <div className="flex justify-between text-slate-600">
                <span>Identificador do Lote:</span>
                <span className="font-mono text-slate-800">{loteParaDesfazer.id}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Período:</span>
                <span className="text-slate-800">
                  {formatarDataBR(loteParaDesfazer.periodo?.inicio)} até {formatarDataBR(loteParaDesfazer.periodo?.fim)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total de Débitos:</span>
                <span className="text-rose-600 font-bold">-{formatarValor(loteParaDesfazer.totais?.total_debitos)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total de Créditos:</span>
                <span className="text-emerald-700 font-bold">+{formatarValor(loteParaDesfazer.totais?.total_creditos)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={desfazendo}
                onClick={() => setLoteParaDesfazer(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={desfazendo}
                onClick={handleConfirmarDesfazer}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {desfazendo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Revertendo lote...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Confirmar e Desfazer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

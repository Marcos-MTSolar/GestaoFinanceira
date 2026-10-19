import React, { useState, useEffect, useMemo } from 'react';
import {
  RegraImportacao,
  Categoria,
  ContaBancaria,
  Contato,
  Projeto
} from '../../types';
import { dbService, subscribe } from '../../services/storage';
import {
  Sparkles,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  Filter,
  Layers,
  Building,
  Tag,
  HelpCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Modal } from '../Modal';
import { BANCOS_REGISTRADOS, normalizarDescricao } from '../../utils/extrato';
import { ComboboxCategoria } from './ComboboxCategoria';

interface GerenciadorRegrasProps {
  contas: ContaBancaria[];
}

export const GerenciadorRegras: React.FC<GerenciadorRegrasProps> = ({ contas }) => {
  const [regras, setRegras] = useState<RegraImportacao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'ativas' | 'inativas'>('todas');
  const [filtroBanco, setFiltroBanco] = useState<string>('todos');

  // Modal de Criação / Edição
  const [modalAberto, setModalAberto] = useState(false);
  const [regraEditando, setRegraEditando] = useState<RegraImportacao | null>(null);

  // Campos do formulário
  const [valorTexto, setValorTexto] = useState('');
  const [campo, setCampo] = useState<'descricao' | 'contraparte'>('descricao');
  const [operador, setOperador] = useState<'contem' | 'comeca_com' | 'igual'>('contem');
  const [bancoCodigo, setBancoCodigo] = useState<string>('*');
  const [contaId, setContaId] = useState<string>('*');
  const [tipoLancamento, setTipoLancamento] = useState<'receita' | 'despesa'>('despesa');
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [projetoId, setProjetoId] = useState<string>('');
  const [contatoId, setContatoId] = useState<string>('');
  const [ativa, setAtiva] = useState(true);

  // Modal de Exclusão
  const [regraParaExcluir, setRegraParaExcluir] = useState<RegraImportacao | null>(null);

  // Mensagens
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const carregarDados = () => {
    setRegras(dbService.getRegrasImportacao());
    setCategorias(dbService.getCategorias());
    setContatos(dbService.getContatos());
    setProjetos(dbService.getProjetos());
  };

  useEffect(() => {
    carregarDados();
    const unsubR = subscribe('regras_importacao', carregarDados);
    const unsubC = subscribe('categorias', carregarDados);
    return () => {
      unsubR();
      unsubC();
    };
  }, []);

  const mapaCategorias = useMemo(() => {
    const mapa = new Map<string, Categoria>();
    for (const cat of categorias) mapa.set(cat.id, cat);
    return mapa;
  }, [categorias]);

  const mapaContas = useMemo(() => {
    const mapa = new Map<string, ContaBancaria>();
    for (const c of contas) mapa.set(c.id, c);
    return mapa;
  }, [contas]);

  // Estatísticas
  const estatisticas = useMemo(() => {
    let total = regras.length;
    let ativas = 0;
    let inativas = 0;
    let totalUsos = 0;

    for (const r of regras) {
      if (r.ativa) ativas++;
      else inativas++;
      totalUsos += r.usos || 0;
    }

    return { total, ativas, inativas, totalUsos };
  }, [regras]);

  // Filtragem
  const regrasFiltradas = useMemo(() => {
    return regras.filter((r) => {
      if (filtroStatus === 'ativas' && !r.ativa) return false;
      if (filtroStatus === 'inativas' && r.ativa) return false;
      if (filtroBanco !== 'todos' && r.banco_codigo !== filtroBanco) return false;

      if (busca.trim()) {
        const termo = normalizarDescricao(busca).toLowerCase();
        const valorNorm = normalizarDescricao(r.valor || '').toLowerCase();
        const catNome = (mapaCategorias.get(r.categoria_id)?.nome || '').toLowerCase();
        if (!valorNorm.includes(termo) && !catNome.includes(termo)) {
          return false;
        }
      }

      return true;
    });
  }, [regras, filtroStatus, filtroBanco, busca, mapaCategorias]);

  // Abertura do modal para criação
  const abrirNovaRegra = () => {
    setRegraEditando(null);
    setValorTexto('');
    setCampo('descricao');
    setOperador('contem');
    setBancoCodigo('*');
    setContaId('*');
    setTipoLancamento('despesa');
    setCategoriaId('');
    setProjetoId('');
    setContatoId('');
    setAtiva(true);
    setMensagemErro(null);
    setModalAberto(true);
  };

  // Abertura do modal para edição
  const abrirEditarRegra = (r: RegraImportacao) => {
    setRegraEditando(r);
    setValorTexto(r.valor);
    setCampo(r.campo || 'descricao');
    setOperador(r.operador || 'contem');
    setBancoCodigo(r.banco_codigo || '*');
    setContaId(r.conta_id || '*');
    setTipoLancamento(r.tipoLancamento === 'receita' ? 'receita' : 'despesa');
    setCategoriaId(r.categoria_id);
    setProjetoId(r.projeto_id || '');
    setContatoId(r.contato_id || '');
    setAtiva(r.ativa !== false);
    setMensagemErro(null);
    setModalAberto(true);
  };

  // Alternar ativação de uma regra
  const handleToggleAtiva = (r: RegraImportacao) => {
    try {
      dbService.saveRegraImportacao({
        ...r,
        ativa: !r.ativa,
      });
      setMensagemSucesso(`Regra "${r.valor}" ${!r.ativa ? 'ativada' : 'desativada'} com sucesso.`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (e: any) {
      setMensagemErro(e?.message || 'Erro ao alterar status da regra.');
    }
  };

  // Salvar Regra
  const handleSalvarRegra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valorTexto.trim()) {
      setMensagemErro('Informe o padrão de texto da regra.');
      return;
    }
    if (!categoriaId) {
      setMensagemErro('Selecione uma categoria válida para a regra.');
      return;
    }

    try {
      const valorNormalizado = normalizarDescricao(valorTexto.trim());

      dbService.saveRegraImportacao({
        id: regraEditando?.id,
        banco_codigo: bancoCodigo,
        conta_id: contaId,
        campo,
        operador,
        valor: valorNormalizado,
        categoria_id: categoriaId,
        tipoLancamento,
        projeto_id: projetoId || undefined,
        contato_id: contatoId || undefined,
        ativa,
        usos: regraEditando?.usos ?? 0,
        criadoEm: regraEditando?.criadoEm,
      });

      setModalAberto(false);
      setMensagemSucesso(
        regraEditando
          ? `Regra "${valorNormalizado}" atualizada com sucesso.`
          : `Nova regra "${valorNormalizado}" cadastrada com sucesso.`
      );
      setTimeout(() => setMensagemSucesso(null), 5000);
    } catch (err: any) {
      setMensagemErro(err?.message || 'Falha ao salvar regra de importação.');
    }
  };

  // Excluir Regra
  const handleConfirmarExclusao = () => {
    if (!regraParaExcluir) return;
    try {
      dbService.deleteRegraImportacao(regraParaExcluir.id);
      setMensagemSucesso(`Regra "${regraParaExcluir.valor}" excluída com sucesso.`);
      setRegraParaExcluir(null);
      setTimeout(() => setMensagemSucesso(null), 5000);
    } catch (err: any) {
      setMensagemErro(err?.message || 'Erro ao excluir regra.');
    }
  };

  const obterNomeBanco = (codigo?: string) => {
    if (!codigo || codigo === '*') return 'Todos os Bancos';
    const b = BANCOS_REGISTRADOS.find((item) => item.codigo === codigo);
    return b?.nome || `Banco ${codigo}`;
  };

  return (
    <div className="space-y-6">
      {/* Feedbacks */}
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
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total de Regras</p>
          <p className="text-xl font-bold font-num text-[#003064] mt-1">{estatisticas.total}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Cadastradas e aprendidas</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">Regras Ativas</p>
          <p className="text-xl font-bold font-num text-emerald-700 mt-1">{estatisticas.ativas}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Sugerindo automaticamente</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">Desativadas</p>
          <p className="text-xl font-bold font-num text-amber-700 mt-1">{estatisticas.inativas}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Pausadas pelo usuário</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-[#1A4A85] uppercase tracking-wide">Classificações Feitas</p>
          <p className="text-xl font-bold font-num text-[#1A4A85] mt-1">{estatisticas.totalUsos}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Sugestões aceitas no extrato</p>
        </div>
      </div>

      {/* Barra de Filtros e Adicionar Regra */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por termo ou categoria..."
              aria-label="Buscar regras de importação"
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as any)}
                aria-label="Filtrar por status da regra"
                className="text-xs bg-transparent border-none text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="todas">Todos os status</option>
                <option value="ativas">Apenas Ativas</option>
                <option value="inativas">Apenas Desativadas</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filtroBanco}
                onChange={(e) => setFiltroBanco(e.target.value)}
                aria-label="Filtrar por banco aplicável"
                className="text-xs bg-transparent border-none text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="todos">Todos os Bancos</option>
                <option value="*">Genéricas (*)</option>
                {BANCOS_REGISTRADOS.map((b) => (
                  <option key={b.codigo} value={b.codigo}>
                    {b.nome}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={abrirNovaRegra}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#003064] hover:bg-[#00204A] text-white text-xs font-semibold rounded-xl shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#FCBC00]" />
              <span>Nova Regra</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Regras */}
      {regrasFiltradas.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 text-center shadow-xs">
          <Sparkles className="w-12 h-12 text-[#FCBC00] mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">Nenhuma regra de importação encontrada</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {busca || filtroStatus !== 'todas' || filtroBanco !== 'todos'
              ? 'Tente ajustar sua busca ou filtros para visualizar as regras cadastradas.'
              : 'O sistema aprende regras automaticamente durante as revisões de extratos bancários, ou você pode cadastrar regras personalizadas agora.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Tabela Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-semibold">
                  <th className="py-3 px-4">Padrão de Texto</th>
                  <th className="py-3 px-4">Campo & Condição</th>
                  <th className="py-3 px-4">Banco / Conta</th>
                  <th className="py-3 px-4">Categoria Sugerida</th>
                  <th className="py-3 px-4 text-center">Tipo</th>
                  <th className="py-3 px-4 text-center">Usos</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {regrasFiltradas.map((r) => {
                  const categoria = mapaCategorias.get(r.categoria_id);
                  const nomeConta = r.conta_id === '*' ? 'Todas as contas' : mapaContas.get(r.conta_id)?.nome || 'Conta';
                  const nomeBanco = obterNomeBanco(r.banco_codigo);

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/60 transition-colors ${!r.ativa ? 'opacity-60 bg-slate-50/30' : ''}`}
                    >
                      {/* Padrão */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                          {r.valor}
                        </span>
                      </td>

                      {/* Campo & Condição */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                        <span className="font-medium">
                          {r.campo === 'contraparte' ? 'Favorecido / Contraparte' : 'Descrição'}
                        </span>
                        <div className="text-[10px] text-slate-400 capitalize">
                          {r.operador === 'comeca_com' ? 'Começa com' : r.operador === 'igual' ? 'Exato' : 'Contém'}
                        </div>
                      </td>

                      {/* Banco / Conta */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{nomeBanco}</div>
                        <div className="text-[10px] text-slate-500">{nomeConta}</div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-medium text-xs">
                          <Tag className="w-3 h-3 text-[#003064]" />
                          <span>{categoria?.nome || 'Categoria não encontrada'}</span>
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {r.tipoLancamento === 'receita' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded-md text-[11px]">
                            <TrendingUp className="w-3 h-3" />
                            Receita
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 font-semibold rounded-md text-[11px]">
                            <TrendingDown className="w-3 h-3" />
                            Despesa
                          </span>
                        )}
                      </td>

                      {/* Usos */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-num font-bold text-[11px]">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          {r.usos || 0}
                        </span>
                      </td>

                      {/* Status Ativa / Inativa */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleAtiva(r)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            r.ativa
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                          title={r.ativa ? 'Clique para desativar' : 'Clique para ativar'}
                        >
                          {r.ativa ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                          <span>{r.ativa ? 'Ativa' : 'Desativada'}</span>
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => abrirEditarRegra(r)}
                            className="p-1.5 text-slate-500 hover:text-[#003064] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar regra"
                            aria-label={`Editar regra ${r.valor}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRegraParaExcluir(r)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir regra"
                            aria-label={`Excluir regra ${r.valor}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards Mobile */}
          <div className="lg:hidden divide-y divide-slate-100">
            {regrasFiltradas.map((r) => {
              const categoria = mapaCategorias.get(r.categoria_id);
              const nomeBanco = obterNomeBanco(r.banco_codigo);

              return (
                <div
                  key={r.id}
                  className={`p-4 space-y-2.5 ${!r.ativa ? 'opacity-60 bg-slate-50/40' : 'bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2 py-0.5 rounded-md border border-slate-200">
                        {r.valor}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {r.campo === 'contraparte' ? 'Favorecido' : 'Descrição'} •{' '}
                        {r.operador === 'comeca_com' ? 'Começa com' : r.operador === 'igual' ? 'Exato' : 'Contém'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-num text-[10px] font-bold">
                        <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                        {r.usos || 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleAtiva(r)}
                        className={`p-1.5 rounded-lg text-xs font-semibold ${
                          r.ativa ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {r.ativa ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="inline-flex items-center gap-1 text-slate-800 font-medium truncate max-w-[200px]">
                      <Tag className="w-3 h-3 text-[#003064]" />
                      <span className="truncate">{categoria?.nome || 'Sem categoria'}</span>
                    </span>

                    <span className="text-[10px] text-slate-500">{nomeBanco}</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => abrirEditarRegra(r)}
                      className="px-3 py-1 text-xs font-semibold text-[#003064] bg-slate-100 rounded-lg"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegraParaExcluir(r)}
                      className="px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 rounded-lg"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      <Modal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title={regraEditando ? 'Editar Regra de Importação' : 'Nova Regra de Importação'}
        maxWidth="lg"
      >
        <form onSubmit={handleSalvarRegra} className="space-y-4">
          <div className="p-3 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              As regras de importação associam automaticamente transações bancárias às suas respectivas
              categorias financeiras, reduzindo o esforço de classificação a cada novo extrato.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Padrão / Termo a casar *
              </label>
              <input
                type="text"
                value={valorTexto}
                onChange={(e) => setValorTexto(e.target.value)}
                placeholder="Ex: TARIFA, PIX ENVIADO, ENEL, POSTO IPIRANGA..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] uppercase font-mono"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                O termo será normalizado em maiúsculas sem acentuação para busca insensível.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Campo a comparar</label>
                <select
                  value={campo}
                  onChange={(e) => setCampo(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003064]"
                >
                  <option value="descricao">Descrição Principal do Extrato</option>
                  <option value="contraparte">Favorecido / Contraparte</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Operador de correspondência</label>
                <select
                  value={operador}
                  onChange={(e) => setOperador(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003064]"
                >
                  <option value="contem">Contém em qualquer parte</option>
                  <option value="comeca_com">Começa com o termo</option>
                  <option value="igual">Texto exatamente igual</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Banco Aplicável</label>
                <select
                  value={bancoCodigo}
                  onChange={(e) => setBancoCodigo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003064]"
                >
                  <option value="*">Todos os Bancos (*)</option>
                  {BANCOS_REGISTRADOS.map((b) => (
                    <option key={b.codigo} value={b.codigo}>
                      {b.nome} ({b.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Conta Aplicável</label>
                <select
                  value={contaId}
                  onChange={(e) => setContaId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003064]"
                >
                  <option value="*">Todas as Contas (*)</option>
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Lançamento *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoLancamento('despesa')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                      tipoLancamento === 'despesa'
                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoLancamento('receita')}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                      tipoLancamento === 'receita'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Receita
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria Sugerida *</label>
                <ComboboxCategoria
                  categorias={categorias}
                  tipoLancamento={tipoLancamento}
                  categoriaId={categoriaId}
                  onChange={(id) => setCategoriaId(id)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Projeto (opcional)</label>
                <select
                  value={projetoId}
                  onChange={(e) => setProjetoId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003064]"
                >
                  <option value="">Nenhum</option>
                  {projetos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contato / Fornecedor (opcional)</label>
                <select
                  value={contatoId}
                  onChange={(e) => setContatoId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003064]"
                >
                  <option value="">Nenhum</option>
                  {contatos.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="regra-ativa"
                checked={ativa}
                onChange={(e) => setAtiva(e.target.checked)}
                className="rounded-sm border-slate-300 text-[#003064] focus:ring-[#003064]"
              />
              <label htmlFor="regra-ativa" className="text-xs text-slate-700 font-medium">
                Regra ativa para sugestões automáticas
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalAberto(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-[#003064] hover:bg-[#00204A] text-white rounded-xl shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
            >
              {regraEditando ? 'Salvar Alterações' : 'Criar Regra'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <Modal
        isOpen={!!regraParaExcluir}
        onClose={() => setRegraParaExcluir(null)}
        title="Excluir Regra de Importação"
        maxWidth="md"
      >
        {regraParaExcluir && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Tem certeza que deseja excluir a regra de correspondência com o padrão{' '}
              <strong className="font-mono text-slate-900 bg-slate-100 px-1 rounded-sm">
                "{regraParaExcluir.valor}"
              </strong>
              ? Novas importações não receberão mais esta sugestão automática.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRegraParaExcluir(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusao}
                className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

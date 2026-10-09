import React, { useState, useEffect } from 'react';
import { dbService, subscribe } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { usePrivacy } from '../context/PrivacyContext';
import { formatarCpfCnpj, formatarTelefone, formatarMoeda, formatarDataBR } from '../utils/formatters';
import { Categoria, Contato, TipoContato, TipoLancamento, Lancamento } from '../types';
import { Modal } from '../components/Modal';
import {
  BookOpen,
  Tag,
  Users2,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Building,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Sparkles,
  Search,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  X,
  History,
  AlertTriangle,
  Clock,
  Briefcase
} from 'lucide-react';

export const Cadastros: React.FC = () => {
  const { isAdmin } = useAuth();
  const { formatarValor } = usePrivacy();

  const [abaAtiva, setAbaAtiva] = useState<'categorias' | 'contatos'>('categorias');

  // Categorias State
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [modalCatAberto, setModalCatAberto] = useState(false);
  const [catEditando, setCatEditando] = useState<Categoria | null>(null);
  const [catNome, setCatNome] = useState('');
  const [catTipo, setCatTipo] = useState<TipoLancamento>('despesa');
  const [catCor, setCatCor] = useState('#003064');

  // Contatos State
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [modalContatoAberto, setModalContatoAberto] = useState(false);
  const [contatoEditando, setContatoEditando] = useState<Contato | null>(null);
  const [conNome, setConNome] = useState('');
  const [conTipo, setConTipo] = useState<TipoContato>('fornecedor');
  const [conCpfCnpj, setConCpfCnpj] = useState('');
  const [conTelefone, setConTelefone] = useState('');
  const [conEmail, setConEmail] = useState('');
  const [conCidade, setConCidade] = useState('');

  // Filtros de busca
  const [busca, setBusca] = useState('');
  const [filtroTipoContato, setFiltroTipoContato] = useState<string>('todos');

  // Histórico do Contato (Drawer / Modal)
  const [contatoHistoricoId, setContatoHistoricoId] = useState<string | null>(null);

  const carregar = () => {
    setCategorias(dbService.getCategorias());
    setContatos(dbService.getContatos());
  };

  useEffect(() => {
    carregar();
    const unsubCat = subscribe('categorias', carregar);
    const unsubCon = subscribe('contatos', carregar);
    const unsubLanc = subscribe('lancamentos', carregar);
    return () => {
      unsubCat();
      unsubCon();
      unsubLanc();
    };
  }, []);

  // Handlers Categorias
  const abrirNovaCategoria = () => {
    setCatEditando(null);
    setCatNome('');
    setCatTipo('despesa');
    setCatCor('#003064');
    setModalCatAberto(true);
  };

  const abrirEditarCategoria = (c: Categoria) => {
    setCatEditando(c);
    setCatNome(c.nome);
    setCatTipo(c.tipo);
    setCatCor(c.cor);
    setModalCatAberto(true);
  };

  const salvarCategoria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    dbService.saveCategoria({
      id: catEditando ? catEditando.id : 'cat-' + Date.now(),
      nome: catNome.trim(),
      tipo: catTipo,
      cor: catCor,
      padrao: catEditando?.padrao,
    });
    setModalCatAberto(false);
  };

  const excluirCategoria = (c: Categoria) => {
    if (!isAdmin) return;
    if (c.padrao) {
      alert('Esta é uma categoria essencial padrão do plano de contas solar e não pode ser excluída.');
      return;
    }
    if (confirm(`Remover categoria "${c.nome}"?`)) {
      dbService.deleteCategoria(c.id);
    }
  };

  // Handlers Contatos
  const abrirNovoContato = () => {
    setContatoEditando(null);
    setConNome('');
    setConTipo('fornecedor');
    setConCpfCnpj('');
    setConTelefone('');
    setConEmail('');
    setConCidade('Cuiabá - MT');
    setModalContatoAberto(true);
  };

  const abrirEditarContato = (c: Contato, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setContatoEditando(c);
    setConNome(c.nome);
    setConTipo(c.tipo);
    setConCpfCnpj(c.cpf_cnpj);
    setConTelefone(c.telefone);
    setConEmail(c.email);
    setConCidade(c.cidade);
    setModalContatoAberto(true);
  };

  const salvarContato = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    dbService.saveContato({
      id: contatoEditando ? contatoEditando.id : 'contato-' + Date.now(),
      nome: conNome.trim(),
      tipo: conTipo,
      cpf_cnpj: conCpfCnpj.trim(),
      telefone: conTelefone.trim(),
      email: conEmail.trim(),
      cidade: conCidade.trim(),
    });
    setModalContatoAberto(false);
  };

  const excluirContato = (id: string, nomeCon: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    if (confirm(`Remover contato "${nomeCon}"?`)) {
      dbService.deleteContato(id);
      if (contatoHistoricoId === id) setContatoHistoricoId(null);
    }
  };

  // Contatos Filtrados
  const contatosFiltrados = contatos.filter(c => {
    if (filtroTipoContato !== 'todos' && c.tipo !== filtroTipoContato) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const nomeMatch = c.nome.toLowerCase().includes(q);
      const docMatch = c.cpf_cnpj.replace(/\D/g, '').includes(q.replace(/\D/g, ''));
      const emailMatch = c.email.toLowerCase().includes(q);
      if (!nomeMatch && !docMatch && !emailMatch) return false;
    }
    return true;
  });

  // Histórico do Contato Ativo
  const historicoAtivo = contatoHistoricoId 
    ? dbService.obterHistoricoContato(contatoHistoricoId) 
    : null;

  return (
    <div className="space-y-6 pb-16">
      
      {/* Topo com Abas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-[#003064] text-[#FCBC00]">
              <BookOpen className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold text-[#1A4A85] uppercase tracking-wider">
              Cadastros Auxiliares MT Solar
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#003064] mt-1">
            Plano de Contas & Contatos
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Categorias padronizadas para o setor solar e histórico financeiro de clientes e fornecedores.
          </p>
        </div>

        {/* Abas */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setAbaAtiva('categorias')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              abaAtiva === 'categorias'
                ? 'bg-white text-[#003064] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-4 h-4 text-[#FCBC00]" />
            <span>Categorias ({categorias.length})</span>
          </button>

          <button
            onClick={() => setAbaAtiva('contatos')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              abaAtiva === 'contatos'
                ? 'bg-white text-[#003064] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users2 className="w-4 h-4 text-[#1A4A85]" />
            <span>Clientes & Fornecedores ({contatos.length})</span>
          </button>
        </div>
      </div>

      {/* CONTEÚDO DA ABA: CATEGORIAS */}
      {abaAtiva === 'categorias' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Categorias organizadas por fluxo financeiro (receitas e despesas) com identificação de cores oficiais da MT Solar.
            </p>
            {isAdmin && (
              <button
                onClick={abrirNovaCategoria}
                className="flex items-center gap-1.5 bg-[#003064] text-white px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-[#00204A] transition-all cursor-pointer shadow-xs border-b-2 border-[#FCBC00] self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 text-[#FCBC00]" />
                <span>+ Nova Categoria</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Receitas */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-serif font-bold text-base text-[#16A34A] flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4" />
                  Categorias de Receitas (+)
                </span>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {categorias.filter(c => c.tipo === 'receita').length} itens
                </span>
              </div>

              <div className="space-y-2">
                {categorias.filter(c => c.tipo === 'receita').map(cat => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.cor }}
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">{cat.nome}</span>
                        {cat.padrao && (
                          <span className="text-[9px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded-sm border border-slate-200">
                            Padrão Solar
                          </span>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => abrirEditarCategoria(cat)}
                          className="p-1.5 text-slate-400 hover:text-[#003064] hover:bg-white rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!cat.padrao && (
                          <button
                            onClick={() => excluirCategoria(cat)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Despesas */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-serif font-bold text-base text-[#DC2626] flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4" />
                  Categorias de Despesas (-)
                </span>
                <span className="text-[11px] font-bold text-red-800 bg-red-50 px-2 py-0.5 rounded-full">
                  {categorias.filter(c => c.tipo === 'despesa').length} itens
                </span>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {categorias.filter(c => c.tipo === 'despesa').map(cat => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.cor }}
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">{cat.nome}</span>
                        {cat.padrao && (
                          <span className="text-[9px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded-sm border border-slate-200">
                            Padrão Solar
                          </span>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => abrirEditarCategoria(cat)}
                          className="p-1.5 text-slate-400 hover:text-[#003064] hover:bg-white rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!cat.padrao && (
                          <button
                            onClick={() => excluirCategoria(cat)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA: CONTATOS (CLIENTES E FORNECEDORES) */}
      {abaAtiva === 'contatos' && (
        <div className="space-y-6">
          
          {/* Barra de Filtro e Busca */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome, CNPJ/CPF ou e-mail..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#003064] focus:outline-none transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filtroTipoContato}
                onChange={(e) => setFiltroTipoContato(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[#003064] text-slate-700 w-full sm:w-auto"
              >
                <option value="todos">Todos os Contatos</option>
                <option value="cliente">Clientes</option>
                <option value="fornecedor">Fornecedores</option>
                <option value="ambos">Cliente & Fornecedor</option>
              </select>

              {isAdmin && (
                <button
                  onClick={abrirNovoContato}
                  className="flex items-center gap-1.5 bg-[#003064] hover:bg-[#00204A] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 text-[#FCBC00]" />
                  <span>Novo Contato</span>
                </button>
              )}
            </div>
          </div>

          {/* Cards dos Contatos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {contatosFiltrados.map((con) => {
              const hist = dbService.obterHistoricoContato(con.id);
              return (
                <div
                  key={con.id}
                  onClick={() => setContatoHistoricoId(con.id)}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group hover:border-[#1A4A85]/50"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                        con.tipo === 'cliente'
                          ? 'bg-blue-100 text-[#003064]'
                          : con.tipo === 'fornecedor'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {con.tipo}
                      </span>

                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={(e) => abrirEditarContato(con, e)}
                            className="p-1.5 text-slate-400 hover:text-[#003064] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => excluirContato(con.id, con.nome, e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h3 className="font-serif font-bold text-base text-[#003064] mb-2 leading-snug group-hover:text-[#1A4A85] transition-colors">
                      {con.nome}
                    </h3>

                    <div className="space-y-1.5 text-xs text-slate-600 mb-4">
                      {con.cpf_cnpj && (
                        <p className="flex items-center gap-2">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatarCpfCnpj(con.cpf_cnpj)}</span>
                        </p>
                      )}
                      {con.telefone && (
                        <p className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatarTelefone(con.telefone)}</span>
                        </p>
                      )}
                      {con.email && (
                        <p className="flex items-center gap-2 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{con.email}</span>
                        </p>
                      )}
                      {con.cidade && (
                        <p className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{con.cidade}</span>
                        </p>
                      )}
                    </div>

                    {/* Resumo Financeiro do Contato */}
                    {hist && (
                      <div className="bg-[#F5F7FA] p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-500">Histórico de Movimentações:</span>
                          <span className="font-bold text-[#003064]">{hist.totalLancamentos} lançamentos</span>
                        </div>
                        {con.tipo !== 'fornecedor' && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-emerald-700">Total Recebido:</span>
                            <span className="font-semibold text-emerald-800">{formatarValor(hist.totalRecebido)}</span>
                          </div>
                        )}
                        {con.tipo !== 'cliente' && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-red-600">Total Pago:</span>
                            <span className="font-semibold text-red-700">{formatarValor(hist.totalPago)}</span>
                          </div>
                        )}
                        {hist.inadimplenteReceber > 0 && (
                          <div className="flex justify-between items-center text-[11px] text-red-700 font-bold pt-1 border-t border-slate-200">
                            <span>Vencido / Inadimplente:</span>
                            <span>{formatarValor(hist.inadimplenteReceber)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#1A4A85] font-semibold">
                    <span className="flex items-center gap-1">
                      <History className="w-3.5 h-3.5" />
                      Ver Histórico Completo
                    </span>
                    <span>→</span>
                  </div>
                </div>
              );
            })}
          </div>

          {contatosFiltrados.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400">
              <Users2 className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="text-base font-semibold text-slate-600">Nenhum contato encontrado</p>
              <p className="text-xs mt-1">Cadastre clientes solares ou fornecedores de equipamentos.</p>
            </div>
          )}

        </div>
      )}

      {/* MODAL / DRAWER DE HISTÓRICO DO CONTATO */}
      {historicoAtivo && (
        <Modal
          isOpen={!!contatoHistoricoId}
          onClose={() => setContatoHistoricoId(null)}
          title={`Histórico de Lançamentos – ${historicoAtivo.contato.nome}`}
          subtitle="Todos os títulos financeiros, vencimentos e conciliações vinculadas a este contato"
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">Total Recebido</span>
                <span className="font-serif font-bold text-emerald-700 text-sm">
                  {formatarValor(historicoAtivo.totalRecebido)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">Total Pago</span>
                <span className="font-serif font-bold text-red-600 text-sm">
                  {formatarValor(historicoAtivo.totalPago)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">A Receber Pendente</span>
                <span className="font-bold text-[#003064] text-sm">
                  {formatarValor(historicoAtivo.aReceberPendente)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">A Pagar Pendente</span>
                <span className="font-bold text-amber-700 text-sm">
                  {formatarValor(historicoAtivo.aPagarPendente)}
                </span>
              </div>
            </div>

            {/* Inadimplência Alerta */}
            {historicoAtivo.inadimplenteReceber > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>
                  <strong>Atenção:</strong> Há títulos vencidos a receber no total de{' '}
                  <strong>{formatarValor(historicoAtivo.inadimplenteReceber)}</strong>.
                </span>
              </div>
            )}

            {/* Tabela de Lançamentos */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-[#F5F7FA] text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Descrição</th>
                    <th className="py-2.5 px-3">Vencimento</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historicoAtivo.lancamentos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        Nenhum lançamento vinculado a este contato.
                      </td>
                    </tr>
                  ) : (
                    historicoAtivo.lancamentos.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                            l.tipo === 'receita' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {l.tipo}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800">{l.descricao}</td>
                        <td className="py-2 px-3">{formatarDataBR(l.data_vencimento)}</td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            l.status === 'pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-right font-serif font-bold ${
                          l.tipo === 'receita' ? 'text-emerald-700' : 'text-red-600'
                        }`}>
                          {l.tipo === 'receita' ? '+' : '-'}{formatarValor(l.valor)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setContatoHistoricoId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Categoria */}
      <Modal
        isOpen={modalCatAberto}
        onClose={() => setModalCatAberto(false)}
        title={catEditando ? 'Editar Categoria' : 'Nova Categoria'}
        subtitle="Estruture o plano de contas da MT Solar com identificação visual"
        maxWidth="md"
      >
        <form onSubmit={salvarCategoria} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome da Categoria *
            </label>
            <input
              type="text"
              value={catNome}
              onChange={(e) => setCatNome(e.target.value)}
              placeholder="Ex: Módulos Fotovoltaicos / Painéis"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo *
              </label>
              <select
                value={catTipo}
                onChange={(e) => setCatTipo(e.target.value as TipoLancamento)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
              >
                <option value="receita">Receita (+)</option>
                <option value="despesa">Despesa (-)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cor de Destaque
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={catCor}
                  onChange={(e) => setCatCor(e.target.value)}
                  className="w-9 h-9 p-0.5 border border-slate-300 rounded-lg cursor-pointer bg-white"
                />
                <input
                  type="text"
                  value={catCor}
                  onChange={(e) => setCatCor(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-xl uppercase font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalCatAberto(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#003064] hover:bg-[#00204A] rounded-xl shadow-xs border-b-2 border-[#FCBC00] transition-colors cursor-pointer"
            >
              Salvar Categoria
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Contato */}
      <Modal
        isOpen={modalContatoAberto}
        onClose={() => setModalContatoAberto(false)}
        title={contatoEditando ? 'Editar Contato' : 'Novo Contato'}
        subtitle="Cadastre clientes ou fornecedores de equipamentos para a MT Solar"
        maxWidth="lg"
      >
        <form onSubmit={salvarContato} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome Completo / Razão Social *
            </label>
            <input
              type="text"
              value={conNome}
              onChange={(e) => setConNome(e.target.value)}
              placeholder="Ex: Aldo Solar Distribuidora"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Contato *
              </label>
              <select
                value={conTipo}
                onChange={(e) => setConTipo(e.target.value as TipoContato)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
              >
                <option value="fornecedor">Fornecedor (Equipamentos / Serviços)</option>
                <option value="cliente">Cliente (Contratante da Usina)</option>
                <option value="ambos">Cliente & Fornecedor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CPF ou CNPJ
              </label>
              <input
                type="text"
                value={conCpfCnpj}
                onChange={(e) => setConCpfCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={conTelefone}
                onChange={(e) => setConTelefone(e.target.value)}
                placeholder="(65) 99999-9999"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={conEmail}
                onChange={(e) => setConEmail(e.target.value)}
                placeholder="contato@empresa.com.br"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cidade - UF
            </label>
            <input
              type="text"
              value={conCidade}
              onChange={(e) => setConCidade(e.target.value)}
              placeholder="Ex: Cuiabá - MT"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalContatoAberto(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#003064] hover:bg-[#00204A] rounded-xl shadow-xs border-b-2 border-[#FCBC00] transition-colors cursor-pointer"
            >
              Salvar Contato
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

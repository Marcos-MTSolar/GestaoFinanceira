import React, { useState, useEffect, useRef } from 'react';
import { dbService, subscribe } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { ConfiguracoesEmpresa, UsuarioAutorizado, PapelUsuario, RegistroAuditoria } from '../types';
import { Modal } from '../components/Modal';
import { exportarTabelaGenericaCSV } from '../utils/csvExporter';
import {
  Settings,
  Building2,
  Users,
  ShieldCheck,
  Eye,
  Percent,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle2,
  Mail,
  UserCheck,
  Sparkles,
  Lock,
  Download,
  Upload,
  Database,
  History,
  FileText,
  AlertTriangle,
  Search,
  RefreshCw,
  HelpCircle,
  Clock,
  CloudUpload
} from 'lucide-react';

export const Configuracoes: React.FC = () => {
  const { usuario, isAdmin } = useAuth();

  const [config, setConfig] = useState<ConfiguracoesEmpresa>(dbService.getConfiguracoes());
  const [usuarios, setUsuarios] = useState<UsuarioAutorizado[]>(dbService.getUsuariosAutorizados());
  const [historico, setHistorico] = useState<RegistroAuditoria[]>(dbService.getHistoricoAlteracoes());
  const [isModoDemo, setIsModoDemo] = useState<boolean>(dbService.isModoDemonstracao());
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);
  const [mensagemStatus, setMensagemStatus] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  // Filtro de Histórico
  const [buscaHistorico, setBuscaHistorico] = useState('');
  const [filtroModuloHistorico, setFiltroModuloHistorico] = useState<string>('todos');

  // Modal Novo Usuário
  const [modalUsuarioAberto, setModalUsuarioAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoPapel, setNovoPapel] = useState<PapelUsuario>('visualizador');

  // Modal Importar Backup JSON
  const [modalImportarAberto, setModalImportarAberto] = useState(false);
  const [conteudoJsonImportar, setConteudoJsonImportar] = useState<string>('');
  const [dadosPreviaImportacao, setDadosPreviaImportacao] = useState<any>(null);
  const [importandoNuvem, setImportandoNuvem] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportarDadosLocaisParaNuvem = async () => {
    if (!isAdmin) return;
    if (!confirm('Deseja ler todos os dados salvos no localStorage local do seu navegador e enviá-los ao banco na nuvem Firestore?')) {
      return;
    }
    setImportandoNuvem(true);
    try {
      const res = await dbService.importarDadosLocaisParaNuvem();
      if (res.sucesso) {
        setMensagemStatus({ tipo: 'sucesso', texto: res.mensagem });
        carregarDados();
      } else {
        setMensagemStatus({ tipo: 'erro', texto: res.mensagem });
      }
    } catch (e: any) {
      setMensagemStatus({ tipo: 'erro', texto: 'Erro na importação: ' + (e?.message || 'Falha na conexão com Firestore') });
    } finally {
      setImportandoNuvem(false);
      setTimeout(() => setMensagemStatus(null), 6000);
    }
  };

  const carregarDados = () => {
    setConfig(dbService.getConfiguracoes());
    setUsuarios(dbService.getUsuariosAutorizados());
    setHistorico(dbService.getHistoricoAlteracoes());
    setIsModoDemo(dbService.isModoDemonstracao());
  };

  useEffect(() => {
    carregarDados();
    const unsubConfig = subscribe('configuracoes', carregarDados);
    const unsubUsers = subscribe('usuarios', carregarDados);
    const unsubHist = subscribe('historico', carregarDados);
    const unsubDemo = subscribe('modo_demo', carregarDados);
    return () => {
      unsubConfig();
      unsubUsers();
      unsubHist();
      unsubDemo();
    };
  }, []);

  const handleSalvarConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    dbService.saveConfiguracoes(config);
    dbService.registrarAlteracao('sistema', 'edicao', 'Parâmetros corporativos atualizados', `CNPJ: ${config.cnpj}, Empresa: ${config.razao_social}`);
    setSalvoComSucesso(true);
    setTimeout(() => setSalvoComSucesso(false), 3000);
  };

  const handleAdicionarUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!novoEmail.trim()) return;

    const novo: UsuarioAutorizado = {
      id: 'user-' + Date.now(),
      nome: novoNome.trim() || novoEmail.split('@')[0],
      email: novoEmail.trim().toLowerCase(),
      papel: novoPapel,
      data_adicionado: new Date().toISOString().split('T')[0],
      adicionado_por: usuario?.email,
    };

    dbService.saveUsuarioAutorizado(novo);
    dbService.registrarAlteracao('sistema', 'criacao', `Novo usuário autorizado: ${novo.email}`, `Papel: ${novo.papel}`);
    setModalUsuarioAberto(false);
    setNovoNome('');
    setNovoEmail('');
    setNovoPapel('visualizador');
  };

  const handleRemoverUsuario = (id: string, emailUsuario: string) => {
    if (!isAdmin) return;
    if (emailUsuario.toLowerCase() === usuario?.email.toLowerCase()) {
      alert('Você não pode remover sua própria conta de usuário logado.');
      return;
    }

    if (confirm(`Remover autorização de acesso para "${emailUsuario}"?`)) {
      const ok = dbService.deleteUsuarioAutorizado(id);
      if (!ok) {
        alert('Não é possível remover o último Administrador do sistema.');
      } else {
        dbService.registrarAlteracao('sistema', 'exclusao', `Usuário desautorizado: ${emailUsuario}`);
      }
    }
  };

  const handleAlterarPapel = (u: UsuarioAutorizado, novoPapel: PapelUsuario) => {
    if (!isAdmin) return;
    dbService.saveUsuarioAutorizado({
      ...u,
      papel: novoPapel,
    });
    dbService.registrarAlteracao('sistema', 'edicao', `Papel do usuário ${u.email} alterado para ${novoPapel}`);
  };

  // EXPORTAR BACKUP JSON
  const handleExportarBackup = () => {
    try {
      const json = dbService.exportarBackupCompletoJSON();
      const hoje = new Date().toISOString().split('T')[0];
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MT_Solar_Backup_Completo_${hoje}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      dbService.registrarAlteracao('sistema', 'edicao', 'Backup completo do sistema exportado em JSON');
      setMensagemStatus({ tipo: 'sucesso', texto: 'Arquivo de backup gerado com sucesso!' });
      setTimeout(() => setMensagemStatus(null), 4000);
    } catch (e: any) {
      alert('Erro ao gerar arquivo de backup: ' + e?.message);
    }
  };

  // SELEÇÃO DO ARQUIVO JSON PARA IMPORTAR
  const handleSelecionarArquivoJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const texto = event.target?.result as string;
      try {
        const parsed = JSON.parse(texto);
        const dados = parsed.dados || parsed;
        setConteudoJsonImportar(texto);
        setDadosPreviaImportacao({
          app: parsed.app || 'MT Solar',
          dataExportacao: parsed.data_exportacao || 'Data não identificada',
          contas: Array.isArray(dados.contas) ? dados.contas.length : 0,
          lancamentos: Array.isArray(dados.lancamentos) ? dados.lancamentos.length : 0,
          funcionarios: Array.isArray(dados.funcionarios) ? dados.funcionarios.length : 0,
          projetos: Array.isArray(dados.projetos) ? dados.projetos.length : 0,
          contatos: Array.isArray(dados.contatos) ? dados.contatos.length : 0,
          categorias: Array.isArray(dados.categorias) ? dados.categorias.length : 0,
        });
        setModalImportarAberto(true);
      } catch (err: any) {
        alert('O arquivo selecionado não é um JSON válido: ' + err?.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // CONFIRMAR IMPORTAÇÃO DO BACKUP
  const handleConfirmarImportacao = () => {
    if (!conteudoJsonImportar) return;
    const resultado = dbService.importarBackupCompletoJSON(conteudoJsonImportar);
    if (resultado.sucesso) {
      setModalImportarAberto(false);
      setConteudoJsonImportar('');
      setDadosPreviaImportacao(null);
      carregarDados();
      setMensagemStatus({ tipo: 'sucesso', texto: resultado.mensagem });
      setTimeout(() => setMensagemStatus(null), 5000);
    } else {
      alert(resultado.mensagem);
    }
  };

  // CARREGAR DADOS DE DEMONSTRAÇÃO
  const handleCarregarDemo = () => {
    if (!isAdmin) return;
    if (confirm('Deseja carregar a base de demonstração completa com lançamentos, obras solares, contas e colaboradores de teste?')) {
      dbService.carregarModoDemonstracao();
      carregarDados();
      setMensagemStatus({ tipo: 'sucesso', texto: 'Modo Demonstração ativado com base de exemplo completa!' });
      setTimeout(() => setMensagemStatus(null), 4000);
    }
  };

  // LIMPAR DADOS DE DEMONSTRAÇÃO
  const handleLimparDemo = () => {
    if (!isAdmin) return;
    if (confirm('Atenção: Deseja apagar todos os dados de teste e começar com a base limpa para operação real da MT Solar?')) {
      dbService.limparDadosDemonstracao();
      carregarDados();
      setMensagemStatus({ tipo: 'sucesso', texto: 'Dados de teste removidos! Sistema limpo para uso operacional.' });
      setTimeout(() => setMensagemStatus(null), 4000);
    }
  };

  // EXPORTAR AUDITORIA EM CSV
  const handleExportarAuditoriaCSV = () => {
    const colunas = [
      'Data e Hora',
      'Usuário',
      'E-mail',
      'Módulo',
      'Ação',
      'Descrição',
      'Detalhes'
    ];
    const dados = historicoFiltrado.map(h => [
      new Date(h.data_hora).toLocaleString('pt-BR'),
      h.usuario_nome,
      h.usuario_email,
      h.modulo.toUpperCase(),
      h.acao.toUpperCase(),
      h.descricao,
      h.detalhes || '',
    ]);
    exportarTabelaGenericaCSV(`MT_Solar_Historico_Auditoria_${new Date().toISOString().split('T')[0]}`, colunas, dados);
  };

  const historicoFiltrado = historico.filter(item => {
    const atendeModulo = filtroModuloHistorico === 'todos' || item.modulo === filtroModuloHistorico;
    const busca = buscaHistorico.toLowerCase();
    const atendeBusca = !busca ||
      item.descricao.toLowerCase().includes(busca) ||
      item.usuario_nome.toLowerCase().includes(busca) ||
      item.usuario_email.toLowerCase().includes(busca) ||
      (item.detalhes && item.detalhes.toLowerCase().includes(busca));
    return atendeModulo && atendeBusca;
  });

  return (
    <div className="space-y-8 pb-16">
      
      {/* Topo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl font-bold text-[#003064] flex items-center gap-2">
              <Settings className="w-6 h-6 text-[#1A4A85]" />
              Configurações & Administração
            </h2>
            {isModoDemo && (
              <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Modo Demonstração Ativo
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastros corporativos, controle de acesso RBAC, backup JSON, dados de teste e histórico de auditoria.
          </p>
        </div>

        {salvoComSucesso && (
          <div className="flex items-center gap-2 text-xs font-bold text-[#16A34A] bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            Configurações salvas com sucesso!
          </div>
        )}

        {mensagemStatus && (
          <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl border animate-in fade-in ${
            mensagemStatus.tipo === 'sucesso'
              ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
              : 'text-red-800 bg-red-50 border-red-300'
          }`}>
            <CheckCircle2 className="w-4 h-4" />
            {mensagemStatus.texto}
          </div>
        )}
      </div>

      {/* SEÇÃO 1: BACKUP & GESTÃO DA BASE DE DADOS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
        <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#003064] flex items-center gap-2">
              <Database className="w-5 h-5 text-[#FCBC00]" />
              Backup & Restauração de Dados
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Exporte todos os lançamentos, contas, usinas e folha em formato JSON legível, ou restaure um backup anterior.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Exportar Backup */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-1">
                <Download className="w-4 h-4 text-[#003064]" />
                Exportar Backup Completo (JSON)
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Gera um arquivo com todos os dados atuais: contas, lançamentos, projetos solares, colaboradores, contatos, categorias e logs de auditoria.
              </p>
            </div>
            <button
              onClick={handleExportarBackup}
              type="button"
              className="w-full py-2.5 px-4 bg-[#003064] hover:bg-[#00204A] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer border-b-2 border-[#FCBC00]"
            >
              <Download className="w-4 h-4 text-[#FCBC00]" />
              <span>Baixar Backup Completo (.json)</span>
            </button>
          </div>

          {/* Card Importar Backup */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-1">
                <Upload className="w-4 h-4 text-emerald-700" />
                Restaurar Backup (JSON)
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Carregue um arquivo JSON gerado anteriormente. Você poderá conferir a quantidade de registros antes de confirmar a substituição.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleSelecionarArquivoJson}
                className="hidden"
                id="input-backup-json"
                disabled={!isAdmin}
              />
              <label
                htmlFor="input-backup-json"
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  isAdmin
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Upload className="w-4 h-4 text-emerald-200" />
                <span>Selecionar Arquivo JSON para Restaurar</span>
              </label>
            </div>
          </div>

          {/* Card Importar dados locais para a nuvem (Migração Firestore) */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 flex flex-col justify-between gap-4 md:col-span-2">
            <div>
              <div className="flex items-center gap-2 text-[#003064] font-bold text-sm mb-1">
                <CloudUpload className="w-4 h-4 text-[#003064]" />
                Migração para a Nuvem Firestore
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Se você possui dados cadastrados no armazenamento local (localStorage) deste computador, clique no botão abaixo para enviá-los de forma única para o banco de dados na nuvem (Firestore).
              </p>
            </div>
            <div>
              <button
                onClick={handleImportarDadosLocaisParaNuvem}
                disabled={!isAdmin || importandoNuvem}
                type="button"
                className={`w-full sm:w-auto py-2.5 px-5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs ${
                  isAdmin && !importandoNuvem
                    ? 'bg-[#003064] hover:bg-[#00204A] text-white border-b-2 border-[#FCBC00] cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {importandoNuvem ? (
                  <RefreshCw className="w-4 h-4 text-[#FCBC00] animate-spin" />
                ) : (
                  <CloudUpload className="w-4 h-4 text-[#FCBC00]" />
                )}
                <span>{importandoNuvem ? 'Enviando dados para o Firestore...' : 'Importar dados locais para a nuvem'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* MODO DEMONSTRAÇÃO & RESET */}
        {isAdmin && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-0.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Modo Demonstração (Dados Fictícios de Teste)
              </div>
              <p className="text-xs text-amber-800/80 leading-relaxed max-w-xl">
                Alterne entre uma base rica de exemplo (usinas fotovoltaicas, despesas com inversores, cheques especiais e folha) e uma base zerada pronta para produção real.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCarregarDemo}
                type="button"
                className="px-3.5 py-2 bg-white text-amber-900 hover:bg-amber-100 border border-amber-300 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
              >
                Carregar Dados de Exemplo
              </button>
              <button
                onClick={handleLimparDemo}
                type="button"
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
                title="Apaga os dados de teste e zera a base para produção"
              >
                Limpar / Iniciar Base Real
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO 2: HISTÓRICO DE AUDITORIA & ALTERAÇÕES */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
        <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#003064] flex items-center gap-2">
              <History className="w-5 h-5 text-[#FCBC00]" />
              Histórico de Alterações & Auditoria
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro contínuo de quem alterou o quê e quando nos lançamentos, colaboradores, contas e sistema.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportarAuditoriaCSV}
              type="button"
              className="py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Exportar CSV</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  if (confirm('Deseja limpar todos os registros de histórico de auditoria gravados?')) {
                    dbService.limparHistoricoAlteracoes();
                    setHistorico([]);
                  }
                }}
                type="button"
                className="py-1.5 px-3 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Limpar Logs
              </button>
            )}
          </div>
        </div>

        {/* Filtros da Auditoria */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por descrição, usuário, e-mail ou detalhes..."
              value={buscaHistorico}
              onChange={(e) => setBuscaHistorico(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
            />
          </div>

          <div>
            <select
              value={filtroModuloHistorico}
              onChange={(e) => setFiltroModuloHistorico(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
            >
              <option value="todos">Todos os Módulos</option>
              <option value="lancamentos">Lançamentos Financeiros</option>
              <option value="funcionarios">Funcionários & Equipes</option>
              <option value="projetos">Projetos & Obras</option>
              <option value="contas">Contas Bancárias</option>
              <option value="sistema">Sistema & Usuários</option>
            </select>
          </div>
        </div>

        {/* Tabela do Histórico */}
        <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-slate-200/80">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr className="text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Usuário</th>
                <th className="py-2.5 px-3">Módulo</th>
                <th className="py-2.5 px-3">Ação</th>
                <th className="py-2.5 px-3">Descrição da Alteração</th>
                <th className="py-2.5 px-3">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {historicoFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Nenhum registro de alteração encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                historicoFiltrado.map((h) => {
                  const dataFmt = new Date(h.data_hora).toLocaleString('pt-BR');
                  const corAcao = 
                    h.acao === 'criacao' ? 'bg-emerald-100 text-emerald-800' :
                    h.acao === 'edicao' ? 'bg-blue-100 text-blue-800' :
                    h.acao === 'exclusao' ? 'bg-red-100 text-red-800' :
                    h.acao === 'pagamento' ? 'bg-purple-100 text-purple-800' :
                    'bg-slate-100 text-slate-800';

                  return (
                    <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {dataFmt}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                        <span className="block leading-tight">{h.usuario_nome}</span>
                        <span className="text-[10px] text-slate-400 leading-tight block">{h.usuario_email}</span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#003064] uppercase text-[10px] whitespace-nowrap">
                        {h.modulo}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${corAcao}`}>
                          {h.acao}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {h.descricao}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                        {h.detalhes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEÇÃO 3: USUÁRIOS AUTORIZADOS & CONTROLE DE ACESSO RBAC */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#003064] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#FCBC00]" />
              E-mails Autorizados & Permissões (RBAC)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Somente usuários nesta lista conseguem logar no sistema MT Solar. Administradores têm acesso total; Visualizadores têm acesso somente leitura.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setModalUsuarioAberto(true)}
              className="flex items-center gap-1.5 bg-[#003064] hover:bg-[#00204A] text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 text-[#FCBC00]" />
              <span>Autorizar Novo E-mail</span>
            </button>
          )}
        </div>

        {/* Tabela de Usuários */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-3">Usuário</th>
                <th className="py-2.5 px-3">E-mail Autorizado</th>
                <th className="py-2.5 px-3">Papel de Acesso</th>
                <th className="py-2.5 px-3">Data de Inclusão</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.map((u) => {
                const eAdministrador = u.papel === 'administrador';
                const eUsuarioAtual = u.email.toLowerCase() === usuario?.email.toLowerCase();

                return (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#003064] text-white flex items-center justify-center font-bold text-[11px]">
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">
                            {u.nome} {eUsuarioAtual && <span className="text-[10px] text-[#1A4A85] font-normal">(Você)</span>}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {u.email}
                    </td>

                    <td className="py-3 px-3">
                      {isAdmin ? (
                        <select
                          value={u.papel}
                          onChange={(e) => handleAlterarPapel(u, e.target.value as PapelUsuario)}
                          className={`px-2.5 py-1 text-xs rounded-lg font-semibold border transition-all ${
                            eAdministrador
                              ? 'bg-[#FFF4CC] text-[#003064] border-[#FCBC00]/50'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="administrador">Administrador (Controle Total)</option>
                          <option value="visualizador">Visualizador (Somente Leitura)</option>
                        </select>
                      ) : (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          eAdministrador
                            ? 'bg-[#FFF4CC] text-[#003064]'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {eAdministrador ? 'Administrador' : 'Visualizador'}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-500">
                      {u.data_adicionado}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {isAdmin && !eUsuarioAtual && (
                        <button
                          onClick={() => handleRemoverUsuario(u.id, u.email)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remover autorização"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEÇÃO 4: DADOS CADASTRAIS DA EMPRESA */}
      <form onSubmit={handleSalvarConfig} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
        <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#003064] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#FCBC00]" />
              Dados Cadastrais da MT Solar
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Informações institucionais utilizadas em cabeçalhos de relatórios, propostas e comprovantes.
            </p>
          </div>

          {isAdmin && (
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-[#003064] hover:bg-[#00204A] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#FCBC00]" />
              <span>Salvar Alterações</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Razão Social
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={config.razao_social}
              onChange={(e) => setConfig({ ...config, razao_social: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome Fantasia
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={config.nome_fantasia}
              onChange={(e) => setConfig({ ...config, nome_fantasia: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              CNPJ
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={config.cnpj}
              onChange={(e) => setConfig({ ...config, cnpj: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Inscrição Estadual
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={config.inscricao_estadual}
              onChange={(e) => setConfig({ ...config, inscricao_estadual: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Telefone / WhatsApp Comercial
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={config.telefone}
              onChange={(e) => setConfig({ ...config, telefone: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail Financeiro
            </label>
            <input
              type="email"
              disabled={!isAdmin}
              value={config.email}
              onChange={(e) => setConfig({ ...config, email: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden disabled:bg-slate-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Endereço Completo
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={config.endereco}
              onChange={(e) => setConfig({ ...config, endereco: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cidade / UF
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={config.cidade_uf}
              onChange={(e) => setConfig({ ...config, cidade_uf: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chave PIX Oficial
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={config.chave_pix}
              onChange={(e) => setConfig({ ...config, chave_pix: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden disabled:bg-slate-100"
            />
          </div>
        </div>

        {/* Parâmetros Padrão de Encargos */}
        <div className="pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold text-[#003064] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Percent className="w-4 h-4 text-[#FCBC00]" />
            Percentuais Padrão de Encargos e Tributos
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alíquota Média de Imposto (%)
              </label>
              <input
                type="number"
                step="0.1"
                disabled={!isAdmin}
                value={config.aliquota_imposto_padrao}
                onChange={(e) => setConfig({ ...config, aliquota_imposto_padrao: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                FGTS Padrão Folha (%)
              </label>
              <input
                type="number"
                step="0.1"
                disabled={!isAdmin}
                value={config.encargos_fgts}
                onChange={(e) => setConfig({ ...config, encargos_fgts: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                INSS Patronal Estimado (%)
              </label>
              <input
                type="number"
                step="0.1"
                disabled={!isAdmin}
                value={config.encargos_inss}
                onChange={(e) => setConfig({ ...config, encargos_inss: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden disabled:bg-slate-100"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Modal Adicionar Usuário */}
      <Modal
        isOpen={modalUsuarioAberto}
        onClose={() => setModalUsuarioAberto(false)}
        title="Autorizar Novo Usuário"
        subtitle="Permita que outro e-mail realize o login Google no sistema MT Solar"
        maxWidth="md"
      >
        <form onSubmit={handleAdicionarUsuario} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex: Engenheiro Carlos Silva"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail do Google (Gmail ou Workspace) *
            </label>
            <input
              type="email"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              placeholder="carlos.engenharia@gmail.com"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Papel / Nível de Acesso *
            </label>
            <select
              value={novoPapel}
              onChange={(e) => setNovoPapel(e.target.value as PapelUsuario)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
            >
              <option value="visualizador">Visualizador (Somente Leitura - Não edita dados)</option>
              <option value="administrador">Administrador (Controle Total - Gerencia tudo)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalUsuarioAberto(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-[#003064] hover:bg-[#00204A] text-white rounded-xl shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
            >
              Autorizar Acesso
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Confirmar Importação de Backup JSON */}
      <Modal
        isOpen={modalImportarAberto}
        onClose={() => setModalImportarAberto(false)}
        title="Confirmar Restauração de Backup"
        subtitle="Confira os dados identificados no arquivo JSON antes de restaurar"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Atenção ao restaurar:</p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                Esta ação substituirá os registros atuais pelos dados contidos neste arquivo de backup. Certifique-se de que este é o arquivo correto.
              </p>
            </div>
          </div>

          {dadosPreviaImportacao && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-200/80 pb-1.5 font-semibold text-slate-700">
                <span>Data do Backup:</span>
                <span className="font-mono text-slate-900">{dadosPreviaImportacao.dataExportacao}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-slate-600">
                <div className="flex justify-between p-1.5 bg-white rounded-lg border border-slate-100">
                  <span>Lançamentos:</span>
                  <span className="font-bold text-[#003064]">{dadosPreviaImportacao.lancamentos}</span>
                </div>
                <div className="flex justify-between p-1.5 bg-white rounded-lg border border-slate-100">
                  <span>Funcionários:</span>
                  <span className="font-bold text-[#003064]">{dadosPreviaImportacao.funcionarios}</span>
                </div>
                <div className="flex justify-between p-1.5 bg-white rounded-lg border border-slate-100">
                  <span>Projetos Solares:</span>
                  <span className="font-bold text-[#003064]">{dadosPreviaImportacao.projetos}</span>
                </div>
                <div className="flex justify-between p-1.5 bg-white rounded-lg border border-slate-100">
                  <span>Contas Bancárias:</span>
                  <span className="font-bold text-[#003064]">{dadosPreviaImportacao.contas}</span>
                </div>
                <div className="flex justify-between p-1.5 bg-white rounded-lg border border-slate-100">
                  <span>Clientes/Contatos:</span>
                  <span className="font-bold text-[#003064]">{dadosPreviaImportacao.contatos}</span>
                </div>
                <div className="flex justify-between p-1.5 bg-white rounded-lg border border-slate-100">
                  <span>Categorias:</span>
                  <span className="font-bold text-[#003064]">{dadosPreviaImportacao.categorias}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setModalImportarAberto(false);
                setConteudoJsonImportar('');
                setDadosPreviaImportacao(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarImportacao}
              className="px-5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-xs transition-all cursor-pointer"
            >
              Confirmar & Restaurar Base
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

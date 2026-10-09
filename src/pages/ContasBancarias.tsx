import React, { useState, useEffect } from 'react';
import { dbService, subscribe } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { usePrivacy } from '../context/PrivacyContext';
import { ContaBancaria, TipoConta, ResumoSaldoConta } from '../types';
import { CaixaCard } from '../components/CaixaCard';
import { ExtratoModal } from '../components/ExtratoModal';
import { TransferenciaModal } from '../components/TransferenciaModal';
import { ConciliacaoModal } from '../components/ConciliacaoModal';
import { Modal } from '../components/Modal';
import {
  Landmark,
  Plus,
  ArrowRightLeft,
  Scale,
  Eye,
  EyeOff,
  HelpCircle,
  AlertTriangle,
  Building,
  CheckCircle2,
  Trash2,
  Layers,
  Sparkles
} from 'lucide-react';

export const ContasBancarias: React.FC = () => {
  const { isAdmin } = useAuth();
  const { ocultarValores, toggleOcultarValores } = usePrivacy();

  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [resumos, setResumos] = useState<ResumoSaldoConta[]>([]);
  const [resumoGeral, setResumoGeral] = useState(dbService.calcularResumoGeral());

  // Modais
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [contaEditando, setContaEditando] = useState<ContaBancaria | null>(null);

  const [extratoAberto, setExtratoAberto] = useState(false);
  const [contaExtrato, setContaExtrato] = useState<ContaBancaria | null>(null);

  const [transferenciaAberta, setTransferenciaAberta] = useState(false);
  const [contaTransferenciaOrigem, setContaTransferenciaOrigem] = useState<string | undefined>();

  const [conciliacaoAberta, setConciliacaoAberta] = useState(false);
  const [contaConciliacao, setContaConciliacao] = useState<ContaBancaria | null>(null);

  // Mensagens
  const [mensagemAlerta, setMensagemAlerta] = useState<string | null>(null);

  // Formulário de Conta
  const [nome, setNome] = useState('');
  const [banco, setBanco] = useState('');
  const [tipo, setTipo] = useState<TipoConta>('corrente');
  const [saldoInicial, setSaldoInicial] = useState('0');
  const [dataSaldoInicial, setDataSaldoInicial] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [limiteCheque, setLimiteCheque] = useState('0');
  const [taxaJuros, setTaxaJuros] = useState('8.5');
  const [cor, setCor] = useState('#003064');
  const [ativa, setAtiva] = useState(true);

  const carregarDados = () => {
    const lista = dbService.getContas();
    setContas(lista);
    const r = lista.map((c) => dbService.calcularResumoConta(c));
    setResumos(r);
    setResumoGeral(dbService.calcularResumoGeral());
  };

  useEffect(() => {
    carregarDados();
    const unsubC = subscribe('contas', carregarDados);
    const unsubL = subscribe('lancamentos', carregarDados);
    return () => {
      unsubC();
      unsubL();
    };
  }, []);

  // Handlers Conta
  const abrirModalNova = () => {
    setContaEditando(null);
    setNome('');
    setBanco('Sicoob');
    setTipo('corrente');
    setSaldoInicial('0');
    setDataSaldoInicial(new Date().toISOString().split('T')[0]);
    setLimiteCheque('15000');
    setTaxaJuros('8.5');
    setCor('#003064');
    setAtiva(true);
    setModalContaAberto(true);
  };

  const abrirModalEditar = (c: ContaBancaria) => {
    setContaEditando(c);
    setNome(c.nome);
    setBanco(c.banco);
    setTipo(c.tipo);
    setSaldoInicial(String(c.saldo_inicial));
    setDataSaldoInicial(c.data_saldo_inicial);
    setLimiteCheque(String(c.limite_cheque_especial));
    setTaxaJuros(String(c.taxa_juros_cheque_especial_mensal));
    setCor(c.cor || '#003064');
    setAtiva(c.ativa);
    setModalContaAberto(true);
  };

  const salvarConta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const novaOuEditada: ContaBancaria = {
      id: contaEditando ? contaEditando.id : 'conta-' + Date.now(),
      nome: nome.trim(),
      banco: banco.trim(),
      tipo,
      saldo_inicial: Number(saldoInicial) || 0,
      data_saldo_inicial: dataSaldoInicial,
      limite_cheque_especial: Number(limiteCheque) || 0,
      taxa_juros_cheque_especial_mensal: Number(taxaJuros) || 0,
      cor,
      ativa,
    };

    dbService.saveConta(novaOuEditada);
    setModalContaAberto(false);
  };

  const handleToggleAtiva = (c: ContaBancaria) => {
    if (!isAdmin) return;
    dbService.toggleAtivaConta(c.id);
  };

  const handleExcluirConta = (c: ContaBancaria) => {
    if (!isAdmin) return;

    if (!confirm(`Tem certeza que deseja excluir a conta bancária "${c.nome}"?`)) {
      return;
    }

    const res = dbService.deleteConta(c.id);
    if (!res.sucesso && res.mensagem) {
      setMensagemAlerta(res.mensagem);
      setTimeout(() => setMensagemAlerta(null), 7000);
    }
  };

  // Handlers Ações de Extrato, Transferência e Conciliação
  const abrirExtrato = (c: ContaBancaria) => {
    setContaExtrato(c);
    setExtratoAberto(true);
  };

  const abrirTransferencia = (contaOrigemId?: string) => {
    setContaTransferenciaOrigem(contaOrigemId);
    setTransferenciaAberta(true);
  };

  const abrirConciliacao = (c: ContaBancaria) => {
    setContaConciliacao(c);
    setConciliacaoAberta(true);
  };

  // Resumo Consolidado Formatado para o CaixaCard
  const resumoConsolidado = {
    saldo_real: resumoGeral.saldoRealTotal,
    limite_cheque_total: resumoGeral.limiteChequeTotal,
    cheque_especial_utilizado: resumoGeral.chequeEspecialUsadoTotal,
    cheque_especial_disponivel: resumoGeral.chequeDisponivelTotal,
    saldo_disponivel_total: resumoGeral.saldoDisponivelTotal,
    usando_cheque_especial: resumoGeral.usandoChequeEspecialTotal,
    percentual_cheque_usado: resumoGeral.percentualChequeUsadoTotal,
    alerta_critico_cheque: resumoGeral.alertaCriticoChequeTotal,
    custo_juros_mensal_estimado: resumoGeral.custoJurosMensalTotal,
    custo_juros_diario_estimado: resumoGeral.custoJurosDiarioTotal,
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Topo da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#003064] flex items-center gap-2">
            <Landmark className="w-6 h-6 text-[#1A4A85]" />
            Gestão de Contas Bancárias & Bloco Caixa
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Controle de saldo real, crédito de cheque especial, conciliação e transferências entre contas da MT Solar.
          </p>
        </div>

        {/* Botões Superiores */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={toggleOcultarValores}
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            title="Alternar privacidade de valores"
          >
            {ocultarValores ? (
              <>
                <EyeOff className="w-4 h-4 text-amber-600" />
                <span>Mostrar Valores</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-slate-500" />
                <span>Ocultar Valores</span>
              </>
            )}
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => abrirTransferencia()}
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-[#003064] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4 text-[#1A4A85]" />
                <span>Transferência</span>
              </button>

              <button
                onClick={abrirModalNova}
                type="button"
                className="flex items-center gap-2 bg-[#003064] hover:bg-[#00204A] text-white px-4 py-2 rounded-xl font-semibold text-xs shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#FCBC00]" />
                <span>Nova Conta</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Alerta de erro/bloqueio se tentar excluir conta com lançamentos */}
      {mensagemAlerta && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-xs text-amber-900 flex items-start gap-3 shadow-xs animate-in shake">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-amber-900">Atenção ao excluir conta bancária:</p>
            <p className="mt-0.5 leading-relaxed">{mensagemAlerta}</p>
          </div>
          <button
            onClick={() => setMensagemAlerta(null)}
            className="text-amber-800 font-bold hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Regra Central Explicativa */}
      <div className="p-4 rounded-xl bg-linear-to-r from-[#FFF4CC] to-amber-50 border border-[#FCBC00]/40 flex items-start gap-3">
        <div className="p-2 bg-[#FCBC00] rounded-lg text-[#003064] shrink-0 mt-0.5">
          <HelpCircle className="w-4 h-4" />
        </div>
        <div className="text-xs text-slate-800 space-y-1">
          <p className="font-bold text-[#003064]">
            Regra Central de Saldo da MT Solar:
          </p>
          <p className="leading-relaxed">
            <strong>Saldo Real</strong> = Saldo Inicial + Receitas Pagas − Despesas Pagas. O saldo real <em>nunca inclui o limite do cheque especial</em>. Se o saldo real for negativo, significa que a MT Solar está usando cheque especial bancário.
          </p>
        </div>
      </div>

      {/* 1. BLOCO "CAIXA" CONSOLIDADO NO TOPO */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-serif text-lg font-bold text-[#003064] flex items-center gap-2">
            <span>Caixa Geral Consolidado</span>
            <span className="text-xs font-sans font-normal text-slate-500">
              ({contas.filter(c => c.ativa).length} contas ativas)
            </span>
          </h3>
          <span className="text-xs text-slate-500">
            Soma consolidada de todos os caixas e contas
          </span>
        </div>

        <CaixaCard
          titulo="Caixa Consolidado MT Solar"
          subtitulo="Visão corporativa total: Recursos próprios da empresa vs Limites de crédito disponíveis"
          resumo={resumoConsolidado}
          isConsolidado={true}
          podeEditar={isAdmin}
          onTransferir={() => abrirTransferencia()}
        />
      </div>

      {/* 2. CARTÕES POR CONTA INDIVIDUAL */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#003064]">
              Contas Bancárias Individuais
            </h3>
            <p className="text-xs text-slate-500">
              Clique em "Ver Extrato" para consultar os lançamentos com saldo real acumulado linha a linha.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Total: {contas.length} contas cadastradas
          </span>
        </div>

        <div className="space-y-6">
          {resumos.map((res) => {
            const c = res.conta;
            return (
              <CaixaCard
                key={c.id}
                titulo={c.nome}
                subtitulo={`${c.banco} • Tipo: ${c.tipo.replace('_', ' ')} • Criada em: ${c.data_saldo_inicial}`}
                resumo={{
                  saldo_real: res.saldo_real,
                  limite_cheque_total: res.limite_cheque_total,
                  cheque_especial_utilizado: res.cheque_especial_utilizado,
                  cheque_especial_disponivel: res.cheque_especial_disponivel,
                  saldo_disponivel_total: res.saldo_disponivel_total,
                  usando_cheque_especial: res.usando_cheque_especial,
                  percentual_cheque_usado: res.percentual_cheque_usado,
                  alerta_critico_cheque: res.alerta_critico_cheque,
                  custo_juros_mensal_estimado: res.custo_juros_mensal_estimado,
                  custo_juros_diario_estimado: res.custo_juros_diario_estimado,
                  taxa_mensal: c.taxa_juros_cheque_especial_mensal,
                }}
                conta={c}
                isConsolidado={false}
                podeEditar={isAdmin}
                onClickExtrato={() => abrirExtrato(c)}
                onTransferir={() => abrirTransferencia(c.id)}
                onConciliar={() => abrirConciliacao(c)}
                onEditar={() => abrirModalEditar(c)}
                onToggleAtiva={() => handleToggleAtiva(c)}
                onExcluir={() => handleExcluirConta(c)}
              />
            );
          })}
        </div>
      </div>

      {/* MODAL 1: EXTRATO DA CONTA */}
      <ExtratoModal
        isOpen={extratoAberto}
        onClose={() => setExtratoAberto(false)}
        conta={contaExtrato}
      />

      {/* MODAL 2: TRANSFERÊNCIA ENTRE CONTAS */}
      <TransferenciaModal
        isOpen={transferenciaAberta}
        onClose={() => setTransferenciaAberta(false)}
        contas={contas.filter(c => c.ativa)}
        contaOrigemPreSelecionada={contaTransferenciaOrigem}
      />

      {/* MODAL 3: CONCILIAÇÃO & AJUSTE */}
      <ConciliacaoModal
        isOpen={conciliacaoAberta}
        onClose={() => setConciliacaoAberta(false)}
        conta={contaConciliacao}
      />

      {/* MODAL 4: CADASTRO / EDIÇÃO DE CONTA */}
      <Modal
        isOpen={modalContaAberto}
        onClose={() => setModalContaAberto(false)}
        title={contaEditando ? 'Editar Conta Bancária' : 'Cadastrar Nova Conta'}
        subtitle="Informe os dados da conta corrente, poupança ou caixa operacional da MT Solar"
        maxWidth="lg"
      >
        <form onSubmit={salvarConta} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome da Conta / Identificação *
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Sicoob MT Solar Principal"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Instituição / Banco *
              </label>
              <input
                type="text"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="Ex: Sicoob, Bradesco, BB, Caixa"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo da Conta *
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoConta)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
              >
                <option value="corrente">Conta Corrente PJ</option>
                <option value="poupanca">Poupança / Reserva</option>
                <option value="caixa_fisico">Caixa Físico / Gaveta</option>
                <option value="cartao">Cartão de Crédito Corporativo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cor de Identificação
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="w-10 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5"
                />
                <span className="text-xs text-slate-500">{cor}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Saldo Inicial (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
                required
              />
              <span className="text-[10px] text-slate-400">Saldo no dia do início do controle</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data do Saldo Inicial *
              </label>
              <input
                type="date"
                value={dataSaldoInicial}
                onChange={(e) => setDataSaldoInicial(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* Cheque Especial */}
          <div className="p-4 bg-[#F5F7FA] rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-[#003064] flex items-center gap-1.5">
              <span>Parâmetros de Cheque Especial / Limite de Crédito</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Limite do Cheque Especial (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={limiteCheque}
                  onChange={(e) => setLimiteCheque(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003064]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Taxa de Juros Mensal (% a.m.)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={taxaJuros}
                  onChange={(e) => setTaxaJuros(e.target.value)}
                  placeholder="Ex: 8.5"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#003064]"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="conta-ativa"
              checked={ativa}
              onChange={(e) => setAtiva(e.target.checked)}
              className="rounded-sm border-slate-300 text-[#003064] focus:ring-[#003064]"
            />
            <label htmlFor="conta-ativa" className="text-xs text-slate-700 font-medium">
              Conta ativa (participa do fluxo consolidado)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalContaAberto(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-[#003064] hover:bg-[#00204A] text-white rounded-xl shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
            >
              {contaEditando ? 'Salvar Alterações' : 'Criar Conta'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

// MT Solar - Gestão Financeira
// Componente Combobox Digitável de Categorias com Criação Rápida e Sugestão (Parte 15E)

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Plus, Sparkles, X } from 'lucide-react';
import { Categoria, TipoLancamento } from '../../types';
import { dbService } from '../../services/storage';

interface ComboboxCategoriaProps {
  categoriaId: string;
  tipoLancamento: 'receita' | 'despesa' | 'transferencia' | 'ajuste';
  categorias: Categoria[];
  sugerida?: boolean;
  obrigatorio?: boolean;
  temErro?: boolean;
  onChange: (categoriaId: string, categoriaNome?: string) => void;
  onEnterNext?: () => void;
  inputRefFocus?: (node: HTMLInputElement | null) => void;
  disabled?: boolean;
}

const CORES_PALETA = [
  '#003064', '#1A4A85', '#2563EB', '#0284C7', '#0D9488',
  '#16A34A', '#65A30D', '#CA8A04', '#D97706', '#EA580C',
  '#DC2626', '#E11D48', '#C026D3', '#9333EA', '#7C3AED',
  '#475569', '#64748B'
];

export const ComboboxCategoria: React.FC<ComboboxCategoriaProps> = ({
  categoriaId,
  tipoLancamento,
  categorias,
  sugerida = false,
  obrigatorio = true,
  temErro = false,
  onChange,
  onEnterNext,
  inputRefFocus,
  disabled = false
}) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [indiceFocado, setIndiceFocado] = useState(0);
  const [salvandoNova, setSalvandoNova] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  // Mapeia tipo do lançamento para o tipo de categoria correspondente
  const tipoCategoriaEsperado: TipoLancamento =
    tipoLancamento === 'receita' ? 'receita' : 'despesa';

  // Filtra categorias compatíveis com o tipo de operação
  const categoriasValidas = useMemo(() => {
    return categorias.filter((c) => c.tipo === tipoCategoriaEsperado);
  }, [categorias, tipoCategoriaEsperado]);

  // Categoria atualmente selecionada
  const categoriaSelecionada = useMemo(() => {
    return categorias.find((c) => c.id === categoriaId);
  }, [categorias, categoriaId]);

  // Filtra as opções de acordo com o texto digitado
  const opcoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return categoriasValidas;
    return categoriasValidas.filter((c) =>
      c.nome.toLowerCase().includes(termo)
    );
  }, [categoriasValidas, busca]);

  // Verifica se o texto digitado coincide exatamente com alguma categoria existente
  const temCoincidenciaExata = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return categoriasValidas.some((c) => c.nome.trim().toLowerCase() === termo);
  }, [categoriasValidas, busca]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
        setBusca('');
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  // Ajusta índice focado quando as opções mudarem
  useEffect(() => {
    setIndiceFocado(0);
  }, [opcoesFiltradas.length, busca]);

  const handleSelecionar = (cat: Categoria) => {
    onChange(cat.id, cat.nome);
    setAberto(false);
    setBusca('');
    if (onEnterNext) onEnterNext();
  };

  const handleCriarCategoria = async () => {
    const nomeLimpo = busca.trim();
    if (!nomeLimpo || salvandoNova) return;

    setSalvandoNova(true);
    try {
      const corAleatoria = CORES_PALETA[Math.floor(Math.random() * CORES_PALETA.length)];
      const novaCat: Categoria = {
        id: `cat-${Date.now()}`,
        nome: nomeLimpo,
        tipo: tipoCategoriaEsperado,
        cor: corAleatoria,
        padrao: false
      };

      const salva = dbService.saveCategoria(novaCat);
      onChange(salva.id, salva.nome);
      setAberto(false);
      setBusca('');
      if (onEnterNext) onEnterNext();
    } catch (err) {
      console.error('Falha ao criar categoria em lote:', err);
    } finally {
      setSalvandoNova(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!aberto) {
        setAberto(true);
      } else {
        const total = opcoesFiltradas.length + (!temCoincidenciaExata && busca.trim() ? 1 : 0);
        setIndiceFocado((prev) => (prev + 1) % (total || 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!aberto) {
        setAberto(true);
      } else {
        const total = opcoesFiltradas.length + (!temCoincidenciaExata && busca.trim() ? 1 : 0);
        setIndiceFocado((prev) => (prev - 1 + total) % (total || 1));
      }
    } else if (e.key === 'Enter') {
      if (aberto) {
        e.preventDefault();
        const mostrarCriar = !temCoincidenciaExata && busca.trim().length > 0;
        if (indiceFocado < opcoesFiltradas.length) {
          handleSelecionar(opcoesFiltradas[indiceFocado]);
        } else if (mostrarCriar) {
          handleCriarCategoria();
        }
      } else if (categoriaSelecionada && onEnterNext) {
        onEnterNext();
      }
    } else if (e.key === 'Escape') {
      setAberto(false);
      setBusca('');
    } else if (e.key === 'Tab') {
      setAberto(false);
      setBusca('');
    }
  };

  // Se for transferência ou ajuste, categoria pode ser não aplicável
  const naoExigeCategoria = tipoLancamento === 'transferencia' || tipoLancamento === 'ajuste';

  if (naoExigeCategoria) {
    return (
      <div className="text-[11px] text-slate-400 italic px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
        Não aplicável ({tipoLancamento})
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full min-w-[200px]">
      <div
        className={`group relative flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-white border rounded-xl text-xs transition-all cursor-pointer ${
          temErro && !categoriaId
            ? 'border-red-400 bg-red-50/40 ring-2 ring-red-200'
            : aberto
            ? 'border-[#003064] ring-2 ring-[#003064]/20 shadow-xs'
            : 'border-slate-300 hover:border-slate-400 shadow-2xs'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
        onClick={() => {
          if (!disabled) {
            setAberto(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {categoriaSelecionada ? (
            <>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                style={{ backgroundColor: categoriaSelecionada.cor || '#003064' }}
              />
              <span className="truncate font-semibold text-slate-800" title={categoriaSelecionada.nome}>
                {categoriaSelecionada.nome}
              </span>
              {sugerida && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0"
                  title="Sugerida automaticamente pelas regras de importação"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  Sugerida
                </span>
              )}
            </>
          ) : (
            <span className={`text-[11px] truncate ${temErro ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
              {temErro ? '⚠️ Categoria obrigatória' : 'Selecione uma categoria...'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {categoriaSelecionada && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('', undefined);
                setBusca('');
              }}
              className="p-0.5 hover:text-red-500 rounded transition-colors"
              title="Limpar categoria"
              aria-label="Limpar categoria"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aberto ? 'rotate-180 text-[#003064]' : ''}`} />
        </div>
      </div>

      {/* Dropdown com Busca Digitável */}
      {aberto && !disabled && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Input de Busca */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <input
              ref={(node) => {
                inputRef.current = node;
                if (inputRefFocus) inputRefFocus(node);
              }}
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite para filtrar ou criar..."
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#003064] text-slate-800 placeholder:text-slate-400"
              autoFocus
            />
          </div>

          {/* Lista de Opções */}
          <ul
            ref={listboxRef}
            role="listbox"
            className="max-h-52 overflow-y-auto py-1 text-xs divide-y divide-slate-50"
          >
            {opcoesFiltradas.map((cat, index) => {
              const estaSelecionada = cat.id === categoriaId;
              const estaFocada = index === indiceFocado;

              return (
                <li
                  key={cat.id}
                  role="option"
                  aria-selected={estaSelecionada}
                  onClick={() => handleSelecionar(cat)}
                  onMouseEnter={() => setIndiceFocado(index)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer transition-colors ${
                    estaFocada
                      ? 'bg-blue-50 text-[#003064]'
                      : estaSelecionada
                      ? 'bg-slate-50 text-slate-900 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.cor || '#003064' }}
                    />
                    <span className="truncate">{cat.nome}</span>
                  </div>

                  {estaSelecionada && (
                    <Check className="w-3.5 h-3.5 text-[#003064] shrink-0" />
                  )}
                </li>
              );
            })}

            {/* Opção Criar Nova Categoria */}
            {!temCoincidenciaExata && busca.trim().length > 0 && (
              <li
                role="option"
                onClick={handleCriarCategoria}
                onMouseEnter={() => setIndiceFocado(opcoesFiltradas.length)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold cursor-pointer border-t border-dashed border-amber-200 transition-colors ${
                  indiceFocado === opcoesFiltradas.length
                    ? 'bg-amber-100/70 text-amber-900'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100/50'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="truncate">
                  {salvandoNova ? (
                    'Criando categoria...'
                  ) : (
                    <>
                      Criar categoria <strong className="underline">“{busca.trim()}”</strong>
                    </>
                  )}
                </span>
                <span className="ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900 font-bold shrink-0">
                  {tipoCategoriaEsperado}
                </span>
              </li>
            )}

            {opcoesFiltradas.length === 0 && temCoincidenciaExata && (
              <li className="px-3 py-3 text-center text-[11px] text-slate-400">
                Nenhuma categoria de {tipoCategoriaEsperado} encontrada.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { HardHat, Users, CheckCircle2, ArrowRight } from 'lucide-react';

interface InConstructionProps {
  titulo: string;
  descricao: string;
  funcionalidadesFuturas: string[];
}

export const InConstruction: React.FC<InConstructionProps> = ({
  titulo,
  descricao,
  funcionalidadesFuturas,
}) => {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 text-center relative overflow-hidden">
        
        {/* Detalhe de fundo solar */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#FFF4CC]/50 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
        
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FFF4CC] border border-[#FCBC00]/40 flex items-center justify-center text-[#003064] shadow-xs mb-5">
          <HardHat className="w-8 h-8 text-[#003064]" />
        </div>

        <span className="inline-block text-xs uppercase font-bold tracking-wider text-[#003064] bg-[#FFF4CC] px-3 py-1 rounded-full mb-3 border border-[#FCBC00]/30">
          Módulo em Desenvolvimento • Etapa 2
        </span>

        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#003064] mb-3">
          {titulo}
        </h2>

        <p className="text-sm text-slate-600 max-w-lg mx-auto mb-8">
          {descricao}
        </p>

        {/* Prévia das funcionalidades previstas */}
        <div className="bg-[#F5F7FA] rounded-xl p-6 text-left border border-slate-200/70 max-w-xl mx-auto">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#003064] mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1A4A85]" />
            Funcionalidades previstas para este módulo:
          </h4>
          <ul className="space-y-2.5 text-xs text-slate-700">
            {funcionalidadesFuturas.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 text-xs text-slate-500">
          Os dados financeiros e orçamentos gerais continuam sendo integrados no módulo principal de <strong className="text-[#003064]">Lançamentos</strong> e <strong className="text-[#003064]">Contas a Pagar</strong>.
        </div>

      </div>
    </div>
  );
};

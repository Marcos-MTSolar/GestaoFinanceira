import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  withWhiteBadge?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  withWhiteBadge = true,
}) => {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-11',
    lg: 'h-14',
  }[size];

  const content = (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Símbolo do Sol com Painel Fotovoltaico */}
      <div className="relative flex items-center justify-center flex-shrink-0">
        <svg
          viewBox="0 0 100 100"
          className={`${sizeClasses} w-auto drop-shadow-sm`}
          style={{ minWidth: size === 'sm' ? '32px' : size === 'md' ? '44px' : '56px' }}
        >
          {/* Fundo solar suave */}
          <circle cx="50" cy="50" r="46" fill="#FFF4CC" />
          
          {/* Sol Dourado */}
          <circle cx="50" cy="38" r="16" fill="#FCBC00" />
          
          {/* Raios Solares */}
          <g stroke="#FCBC00" strokeWidth="3" strokeLinecap="round">
            <line x1="50" y1="14" x2="50" y2="7" />
            <line x1="26" y1="38" x2="19" y2="38" />
            <line x1="74" y1="38" x2="81" y2="38" />
            <line x1="33" y1="21" x2="28" y2="16" />
            <line x1="67" y1="21" x2="72" y2="16" />
          </g>

          {/* Módulo / Placa Fotovoltaica com grid */}
          <path
            d="M26 56 L74 56 L70 82 L30 82 Z"
            fill="#003064"
            stroke="#FCBC00"
            strokeWidth="2.2"
          />
          <line x1="50" y1="56" x2="50" y2="82" stroke="#FCBC00" strokeWidth="1.6" />
          <line x1="28" y1="69" x2="72" y2="69" stroke="#FCBC00" strokeWidth="1.6" />
        </svg>
      </div>

      {/* Tipografia da Marca: Azul-Marinho #003064 e Subtítulo #1A4A85 */}
      <div className="flex flex-col justify-center">
        <div className="flex items-baseline gap-1">
          <span
            className="font-serif font-black tracking-tight text-[#003064]"
            style={{
              fontSize: size === 'sm' ? '1.25rem' : size === 'md' ? '1.65rem' : '2.1rem',
              lineHeight: 1,
            }}
          >
            MT Solar
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#FCBC00]" />
        </div>
        <span
          className="text-[#1A4A85] font-semibold uppercase tracking-[0.22em] font-sans"
          style={{
            fontSize: size === 'sm' ? '0.55rem' : size === 'md' ? '0.65rem' : '0.78rem',
            lineHeight: 1.2,
            marginTop: '2px',
          }}
        >
          Energia Renovável
        </span>
      </div>
    </div>
  );

  if (withWhiteBadge) {
    return (
      <div className="inline-flex items-center bg-white px-3.5 py-1.5 rounded-xl shadow-xs border border-slate-100">
        {content}
      </div>
    );
  }

  return content;
};

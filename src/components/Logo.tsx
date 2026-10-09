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
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-12',
    lg: 'h-14 sm:h-16',
  }[size];

  const content = (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Imagem original public/logo.png sempre em fundo claro */}
      <img
        src="/logo.png"
        alt="MT Solar – Energia Renovável"
        className={`${sizeClasses} w-auto object-contain drop-shadow-xs`}
        onError={(e) => {
          // Fallback caso a imagem não carregue
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
        }}
      />
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

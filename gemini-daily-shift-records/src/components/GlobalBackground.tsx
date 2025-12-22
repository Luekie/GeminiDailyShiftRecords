import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export const GlobalBackground: React.FC = () => {
  const { isDarkMode } = useTheme();

  return (
    <div className="fixed inset-0 w-full h-full z-0">
      {/* Light mode gradient - inspired by the image */}
      <div 
        className={`absolute inset-0 transition-opacity duration-500 ${
          isDarkMode ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          background: `
            linear-gradient(135deg, 
              #667eea 0%, 
              #764ba2 25%, 
              #f093fb 50%, 
              #f5576c 75%, 
              #4facfe 100%
            )
          `
        }}
      />
      
      {/* Dark mode gradient */}
      <div 
        className={`absolute inset-0 transition-opacity duration-500 ${
          isDarkMode ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: `
            linear-gradient(135deg, 
              #1a1a2e 0%, 
              #16213e 25%, 
              #0f3460 50%, 
              #533483 75%, 
              #1e3c72 100%
            )
          `
        }}
      />
      
      {/* Animated overlay for extra depth */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 via-transparent to-black/10 animate-pulse" />
      </div>
    </div>
  );
};
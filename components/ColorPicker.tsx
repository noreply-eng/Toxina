import React from 'react';

interface ColorPickerProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ label, color, onChange }) => {
  const presetColors = [
    // Blues
    '#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa', '#0ea5e9',
    // Purples
    '#8b5cf6', '#7c3aed', '#6d28d9', '#a78bfa', '#c084fc',
    // Greens
    '#10b981', '#059669', '#047857', '#34d399', '#6ee7b7',
    // Reds/Pinks
    '#ef4444', '#dc2626', '#f43f5e', '#fb7185', '#ec4899',
    // Oranges/Yellows
    '#f59e0b', '#d97706', '#f97316', '#fbbf24', '#fcd34d',
    // Teals/Cyans
    '#14b8a6', '#0d9488', '#06b6d4', '#22d3ee', '#67e8f9',
    // Grays
    '#6b7280', '#4b5563', '#374151', '#9ca3af', '#1f2937'
  ];

  const handlePresetClick = (presetColor: string) => {
    onChange(presetColor);
  };

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Validate hex color
    if (/^#[0-9A-F]{6}$/i.test(value)) {
      onChange(value);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-text-main dark:text-white">
        {label}
      </label>

      {/* Current Color Preview */}
      <div className="flex items-center gap-3">
        <div 
          className="w-16 h-16 rounded-2xl border-4 border-white dark:border-slate-700 shadow-lg"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1">
          <input
            type="text"
            value={color.toUpperCase()}
            onChange={handleHexInput}
            placeholder="#3B82F6"
            maxLength={7}
            className="w-full px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-text-muted mt-1">Código hexadecimal</p>
        </div>
      </div>

      {/* Native Color Picker */}
      <div className="relative">
        <label className="block text-xs font-medium text-text-muted mb-2">
          Selector de Color
        </label>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-12 rounded-xl cursor-pointer border-2 border-slate-200 dark:border-slate-700"
        />
      </div>

      {/* Preset Colors Grid */}
      <div>
        <label className="block text-xs font-medium text-text-muted mb-2">
          Colores Predefinidos
        </label>
        <div className="grid grid-cols-7 gap-2">
          {presetColors.map((presetColor) => (
            <button
              key={presetColor}
              onClick={() => handlePresetClick(presetColor)}
              className={`w-full aspect-square rounded-lg transition-all hover:scale-110 ${
                color.toLowerCase() === presetColor.toLowerCase()
                  ? 'ring-4 ring-slate-400 dark:ring-slate-500 scale-110'
                  : 'hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600'
              }`}
              style={{ backgroundColor: presetColor }}
              title={presetColor}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorPicker;

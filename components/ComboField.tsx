'use client';

import React, { useState } from 'react';

interface ComboFieldProps {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  required?: boolean;
}

export default function ComboField({
  label,
  value,
  options,
  onChange,
  required = false,
}: ComboFieldProps) {
  const isPreset = options.includes(value);
  const [customMode, setCustomMode] = useState(!isPreset && value !== '');

  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>

      {!customMode ? (
        <select
          value={isPreset ? value : '__custom__'}
          onChange={(e) => {
            if (e.target.value === '__custom__') {
              setCustomMode(true);
            } else {
              onChange(e.target.value);
            }
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
          <option value="__custom__">Custom entry...</option>
        </select>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter custom ${label.toLowerCase()}`}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setCustomMode(false);
              if (!options.includes(value)) onChange(options[0]);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 whitespace-nowrap"
          >
            Presets
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useRef } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bold,
  BookOpen,
  List,
  ListOrdered,
  Plus,
  RotateCcw,
  Trash2,
  Underline,
} from 'lucide-react';
import { LegalClause, LegalSection } from '@/lib/types';

interface LegalContentEditorProps {
  salutation: string;
  openingParagraphs: string[];
  sections: LegalSection[];
  adminVerified: boolean;
  clauses: LegalClause[];
  onChangeSalutation: (val: string) => void;
  onChangeOpeningParagraphs: (paras: string[]) => void;
  onChangeSections: (sections: LegalSection[]) => void;
  onChangeAdminVerified: (val: boolean) => void;
  onRestoreDefault: () => void;
}

const PLACEHOLDERS = [
  '[BRAND NAME]',
  '[APPLICATION NUMBER]',
  '[TRADEMARK CLASS]',
  '[EARLIER TRADEMARK]',
  '[EARLIER APPLICATION NUMBER]',
  '[TOTAL CHARGES]',
];

export default function LegalContentEditor({
  salutation,
  openingParagraphs,
  sections,
  adminVerified,
  clauses,
  onChangeSalutation,
  onChangeOpeningParagraphs,
  onChangeSections,
  onChangeAdminVerified,
  onRestoreDefault,
}: LegalContentEditorProps) {
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const idCounterRef = useRef(100);
  const activeTargetRef = useRef<
    | { kind: 'opening'; idx: number }
    | { kind: 'section'; secIdx: number; pIdx: number }
    | null
  >(null);

  const applyFormatToActive = (mode: 'bold' | 'underline' | 'bullet' | 'numbered' | 'token', tokenText?: string) => {
    const el = activeTextareaRef.current;
    const target = activeTargetRef.current;
    if (!el || !target) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const current = el.value;
    const selected = current.slice(start, end);

    let nextValue = current;
    if (mode === 'bold') {
      const inner = selected || 'important text';
      nextValue = current.slice(0, start) + `**${inner}**` + current.slice(end);
    } else if (mode === 'underline') {
      const inner = selected || 'underlined text';
      nextValue = current.slice(0, start) + `__${inner}__` + current.slice(end);
    } else if (mode === 'bullet') {
      const prefix = start > 0 && current[start - 1] !== '\n' ? '\n• ' : '• ';
      nextValue = current.slice(0, start) + prefix + (selected || 'List item') + current.slice(end);
    } else if (mode === 'numbered') {
      const prefix = start > 0 && current[start - 1] !== '\n' ? '\n1. ' : '1. ';
      nextValue = current.slice(0, start) + prefix + (selected || 'Numbered item') + current.slice(end);
    } else if (mode === 'token' && tokenText) {
      nextValue = current.slice(0, start) + tokenText + current.slice(end);
    }

    if (target.kind === 'opening') {
      const copy = [...openingParagraphs];
      copy[target.idx] = nextValue;
      onChangeOpeningParagraphs(copy);
    } else {
      const copy = [...sections];
      const paras = [...copy[target.secIdx].paragraphs];
      paras[target.pIdx] = nextValue;
      copy[target.secIdx] = { ...copy[target.secIdx], paragraphs: paras };
      onChangeSections(copy);
    }
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const copy = [...sections];
    const [removed] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, removed);
    const renumbered = copy.map((s, i) => ({ ...s, number: String(i + 1) }));
    onChangeSections(renumbered);
  };

  const addSection = () => {
    const nextNum = sections.length + 1;
    idCounterRef.current += 1;
    onChangeSections([
      ...sections,
      {
        id: `sec-${idCounterRef.current}`,
        number: String(nextNum),
        title: 'ADDITIONAL LEGAL OBSERVATION',
        paragraphs: ['Enter verified legal explanation or client instruction here.'],
        underlineHeading: true,
        isFeeSection: false,
      },
    ]);
  };

  const deleteSection = (idx: number) => {
    const filtered = sections.filter((_, i) => i !== idx).map((s, i) => ({ ...s, number: String(i + 1) }));
    onChangeSections(filtered);
  };

  const insertClauseIntoLastSection = (clause: LegalClause) => {
    if (sections.length === 0) {
      idCounterRef.current += 1;
      onChangeSections([
        {
          id: `sec-${idCounterRef.current}`,
          number: '1',
          title: clause.title.toUpperCase(),
          paragraphs: [clause.content],
          underlineHeading: true,
          isFeeSection: false,
        },
      ]);
      return;
    }
    const copy = [...sections];
    const targetIdx = 0;
    copy[targetIdx] = {
      ...copy[targetIdx],
      paragraphs: [...copy[targetIdx].paragraphs, clause.content],
    };
    onChangeSections(copy);
  };

  return (
    <div className="space-y-4">
      {/* Formatting & Placeholder Toolbar */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => applyFormatToActive('bold')}
              title="Bold selected text"
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <Bold className="h-3.5 w-3.5" />
              Bold
            </button>
            <button
              type="button"
              onClick={() => applyFormatToActive('underline')}
              title="Underline selected text"
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <Underline className="h-3.5 w-3.5" />
              Underline
            </button>
            <button
              type="button"
              onClick={() => applyFormatToActive('bullet')}
              title="Insert bullet list item"
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <List className="h-3.5 w-3.5" />
              Bullet
            </button>
            <button
              type="button"
              onClick={() => applyFormatToActive('numbered')}
              title="Insert numbered list item"
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <ListOrdered className="h-3.5 w-3.5" />
              Numbered
            </button>
          </div>

          <button
            type="button"
            onClick={onRestoreDefault}
            className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore Default Content
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-500">Insert placeholder:</span>
          {PLACEHOLDERS.map((tok) => (
            <button
              key={tok}
              type="button"
              onClick={() => applyFormatToActive('token', tok)}
              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#142F55] hover:bg-slate-100"
            >
              {tok}
            </button>
          ))}
        </div>
      </div>

      {/* Salutation & Opening Paragraphs */}
      <div className="space-y-2.5">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Opening Salutation</label>
          <input
            type="text"
            value={salutation}
            onChange={(e) => onChangeSalutation(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700">Opening Paragraphs</label>
            <button
              type="button"
              onClick={() => onChangeOpeningParagraphs([...openingParagraphs, ''])}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#142F55] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add Paragraph
            </button>
          </div>
          {openingParagraphs.map((para, idx) => (
            <div key={idx} className="flex gap-2">
              <textarea
                rows={2}
                value={para}
                onFocus={(e) => {
                  activeTextareaRef.current = e.currentTarget;
                  activeTargetRef.current = { kind: 'opening', idx };
                }}
                onChange={(e) => {
                  const copy = [...openingParagraphs];
                  copy[idx] = e.target.value;
                  onChangeOpeningParagraphs(copy);
                }}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
              />
              {openingParagraphs.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChangeOpeningParagraphs(openingParagraphs.filter((_, i) => i !== idx))}
                  aria-label={`Remove opening paragraph ${idx + 1}`}
                  className="self-start rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Numbered Legal Sections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Numbered Legal Sections
          </h4>
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#142F55] hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Section
          </button>
        </div>

        {sections.map((sec, sIdx) => (
          <div key={sec.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="text-xs font-bold text-[#142F55] w-5 tabular-nums">{sec.number}.</span>
                <input
                  type="text"
                  value={sec.title}
                  onChange={(e) => {
                    const copy = [...sections];
                    copy[sIdx] = { ...copy[sIdx], title: e.target.value };
                    onChangeSections(copy);
                  }}
                  aria-label={`Section ${sec.number} title`}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 focus:border-[#142F55] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1">
                <label className="inline-flex items-center gap-1 text-xs text-slate-600 mr-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sec.underlineHeading}
                    onChange={(e) => {
                      const copy = [...sections];
                      copy[sIdx] = { ...copy[sIdx], underlineHeading: e.target.checked };
                      onChangeSections(copy);
                    }}
                    className="rounded border-slate-300 text-[#142F55]"
                  />
                  Underline
                </label>
                <label className="inline-flex items-center gap-1 text-xs text-slate-600 mr-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sec.isFeeSection}
                    onChange={(e) => {
                      const copy = [...sections];
                      copy[sIdx] = { ...copy[sIdx], isFeeSection: e.target.checked };
                      onChangeSections(copy);
                    }}
                    className="rounded border-slate-300 text-[#142F55]"
                  />
                  Fee Block
                </label>
                <button
                  type="button"
                  onClick={() => moveSection(sIdx, -1)}
                  disabled={sIdx === 0}
                  aria-label={`Move section ${sec.number} up`}
                  className="rounded border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(sIdx, 1)}
                  disabled={sIdx === sections.length - 1}
                  aria-label={`Move section ${sec.number} down`}
                  className="rounded border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteSection(sIdx)}
                  aria-label={`Delete section ${sec.number}`}
                  className="rounded border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {sec.paragraphs.map((para, pIdx) => (
                <div key={pIdx} className="flex gap-2">
                  <textarea
                    rows={3}
                    value={para}
                    onFocus={(e) => {
                      activeTextareaRef.current = e.currentTarget;
                      activeTargetRef.current = { kind: 'section', secIdx: sIdx, pIdx };
                    }}
                    onChange={(e) => {
                      const copy = [...sections];
                      const paras = [...copy[sIdx].paragraphs];
                      paras[pIdx] = e.target.value;
                      copy[sIdx] = { ...copy[sIdx], paragraphs: paras };
                      onChangeSections(copy);
                    }}
                    className="flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
                  />
                  {sec.paragraphs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const copy = [...sections];
                        copy[sIdx] = {
                          ...copy[sIdx],
                          paragraphs: copy[sIdx].paragraphs.filter((_, i) => i !== pIdx),
                        };
                        onChangeSections(copy);
                      }}
                      aria-label={`Remove paragraph ${pIdx + 1} from section ${sec.number}`}
                      className="self-start rounded border border-slate-200 bg-white p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const copy = [...sections];
                  copy[sIdx] = { ...copy[sIdx], paragraphs: [...copy[sIdx].paragraphs, ''] };
                  onChangeSections(copy);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#142F55] hover:underline"
              >
                <Plus className="h-3 w-3" /> Add Paragraph to Section {sec.number}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reusable Legal Clause Quick Insert */}
      {clauses.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
            <BookOpen className="h-3.5 w-3.5 text-[#142F55]" />
            Quick Insert from Legal Content Library
          </div>
          <div className="flex flex-wrap gap-1.5">
            {clauses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => insertClauseIntoLastSection(c)}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                + {c.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Administrator Legal Verification Sign-Off */}
      <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer">
        <input
          type="checkbox"
          checked={adminVerified}
          onChange={(e) => onChangeAdminVerified(e.target.checked)}
          className="mt-0.5 rounded border-slate-300 text-[#142F55]"
        />
        <span className="text-xs text-slate-700 leading-relaxed">
          <strong className="font-semibold text-slate-900">Administrator Legal Verification:</strong> I
          confirm all case-specific trademark numbers, cited marks, legal explanations, and fee
          separations have been reviewed and verified as a private client advisory before PDF export.
        </span>
      </label>
    </div>
  );
}

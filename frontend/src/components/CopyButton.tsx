'use client';

import { useState } from 'react';

type CopyButtonProps = {
  text: string;
  label?: string;
};

export function CopyButton({ text, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500 px-3 py-1 text-sm text-emerald-200 hover:bg-emerald-500/10"
    >
      {copied ? 'Copied!' : label ?? 'Copy'}
    </button>
  );
}

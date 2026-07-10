import { Flame, Send, ListChecks } from 'lucide-react';

interface Props {
  page: 'ingestao' | 'avaliacao';
  onChange: (p: 'ingestao' | 'avaliacao') => void;
}

export function Header({ page, onChange }: Props) {
  return (
    <header className="sticky top-0 z-40 bg-black border-b border-red-600/40 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/30">
            <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-white text-lg font-bold tracking-tight leading-none">FlaNews Translate</h1>
            <p className="text-gray-400 text-xs mt-1">Extração e tradução adaptativa</p>
          </div>
        </div>
        <nav className="flex items-center gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
          <button
            onClick={() => onChange('ingestao')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              page === 'ingestao'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Send className="w-4 h-4" />
            Ingestão
          </button>
          <button
            onClick={() => onChange('avaliacao')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              page === 'avaliacao'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            Avaliação
          </button>
        </nav>
      </div>
    </header>
  );
}

import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { limparNoticias } from '../lib/api';

interface Props {
  total: number;
  onDone?: () => void;
}

export function LimparNoticiasButton({ total, onDone }: Props) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (total === 0) return;
    const ok = confirm(
      `Excluir todas as ${total} notícia(s) — pendentes, aprovadas e reprovadas — com suas traduções e imagens?\n\n` +
        'As referências de tradução e a fila de processamento não são afetadas. Esta ação não pode ser desfeita.'
    );
    if (!ok) return;
    setLoading(true);
    try {
      await limparNoticias();
      onDone?.();
    } catch (e: unknown) {
      alert(`Erro ao limpar notícias: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={loading || total === 0}
      title="Exclui todas as notícias (pendentes, aprovadas e reprovadas)"
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 text-xs font-medium hover:bg-red-600 hover:border-red-600 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-600/10 disabled:hover:text-red-400"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      Limpar notícias
    </button>
  );
}

import { useEffect, useState } from 'react';
import { Send, Link2, Loader2 } from 'lucide-react';
import { MetricsCards } from '../components/MetricsCards';
import { ReferenciasPanel } from '../components/ReferenciasPanel';
import { JobsFila } from '../components/JobsFila';
import { getCounts, enfileirarUrls } from '../lib/api';
import { supabase } from '../lib/supabase';

export function IngestaoPage() {
  const [bulk, setBulk] = useState('');
  const [counts, setCounts] = useState({ pendente: 0, aprovado: 0, reprovado: 0 });
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function refresh() {
    setCounts(await getCounts());
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel('noticias-ch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'noticias' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const urls = bulk
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const valid = [...new Set(urls.filter((u) => /^https?:\/\//.test(u)))];

  async function enviar() {
    if (valid.length === 0) return;
    setEnviando(true);
    setFeedback(null);
    try {
      const result = await enfileirarUrls(valid);
      if (result.ok) {
        const skipped = result.skipped ?? 0;
        setFeedback(
          `${result.enqueued} URL(s) enviada(s) para a fila.` +
            (skipped > 0 ? ` ${skipped} ignorada(s) por já estarem na fila ou em processamento.` : '') +
            (result.enqueued ? ' Processamento iniciado.' : '')
        );
        setBulk('');
      } else {
        setFeedback(`Erro ao enfileirar: ${result.error ?? 'desconhecido'}`);
      }
      refresh();
    } catch (e: any) {
      setFeedback(`Erro: ${String(e?.message ?? e)}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Painel de Ingestão</h2>
        <p className="text-gray-400 text-sm mt-1">
          Envie URLs de notícias do Flamengo para extração e tradução adaptativa em EN e ES.
        </p>
      </div>

      <MetricsCards {...counts} />

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-4 h-4 text-gray-400" />
          <h3 className="text-white font-semibold">Envio de URLs</h3>
        </div>
        <p className="text-gray-500 text-xs mb-3">
          Cole uma ou múltiplas URLs, uma por linha. Todas entram na fila instantaneamente e são processadas em background.
        </p>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={6}
          placeholder={`https://www.flamengo.com.br/noticias/...\nhttps://www.flamengo.com.br/noticias/...`}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 font-mono"
        />
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            {valid.length} URL{valid.length === 1 ? '' : 's'} válida{valid.length === 1 ? '' : 's'}
            {urls.length !== valid.length && ` · ${urls.length - valid.length} inválida(s)`}
          </p>
          <button
            onClick={enviar}
            disabled={enviando || valid.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-neutral-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition shadow-lg shadow-red-600/20"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {enviando ? 'Processando...' : 'Enviar para tradução'}
          </button>
        </div>
        {feedback && (
          <div className="mt-3 text-xs text-gray-300 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2">
            {feedback}
          </div>
        )}
      </div>

      <ReferenciasPanel />
      <JobsFila />
    </div>
  );
}

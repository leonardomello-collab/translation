import { useEffect, useState, useRef } from 'react';
import { Activity, CheckCircle2, XCircle, Loader2, Clock, Trash2, RefreshCw } from 'lucide-react';
import { supabase, JobTraducao } from '../lib/supabase';
import { limparJobs, cancelarJob, reprocessarJob, runWatchdog } from '../lib/api';

export function JobsFila() {
  const [jobs, setJobs] = useState<JobTraducao[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function carregar() {
    const { data } = await supabase
      .from('jobs_traducao')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setJobs((data ?? []) as JobTraducao[]);
  }

  useEffect(() => {
    runWatchdog().then(() => carregar()).catch(() => carregar());

    const ch = supabase
      .channel('jobs-ch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs_traducao' }, () => carregar())
      .subscribe();

    // Polling fallback: refresh every 3s while active jobs exist
    pollRef.current = setInterval(() => {
      carregar();
    }, 3000);

    return () => {
      supabase.removeChannel(ch);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Stop polling when no active jobs (save resources)
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'fila' || j.status === 'processando');
    if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    } else if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(() => { carregar(); }, 3000);
    }
  }, [jobs]);

  async function handleLimpar(filter: 'erro' | 'concluido' | 'todos') {
    setLoading('limpar');
    try { await limparJobs(filter); } finally { setLoading(null); carregar(); }
  }

  async function handleCancelar(id: string) {
    setLoading(id);
    try { await cancelarJob(id); } finally { setLoading(null); carregar(); }
  }

  async function handleReprocessar(id: string) {
    setLoading(id);
    try { await reprocessarJob(id); } finally { setLoading(null); carregar(); }
  }

  function statusBadge(j: JobTraducao) {
    if (j.status === 'concluido') return { Icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10', label: 'Concluido' };
    if (j.status === 'erro') return { Icon: XCircle, color: 'text-red-400 bg-red-500/10', label: 'Erro' };
    if (j.status === 'processando') return { Icon: Loader2, color: 'text-blue-400 bg-blue-500/10 animate-spin', label: j.fase === 'extracao' ? 'Extraindo' : 'Traduzindo' };
    return { Icon: Clock, color: 'text-amber-400 bg-amber-500/10', label: 'Na fila' };
  }

  const temErros = jobs.some((j) => j.status === 'erro');
  const temConcluidos = jobs.some((j) => j.status === 'concluido');

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" />
          <h3 className="text-white font-semibold text-sm">Fila de processamento</h3>
          <span className="text-xs text-gray-500">({jobs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {temErros && (
            <button
              onClick={() => handleLimpar('erro')}
              disabled={loading === 'limpar'}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-red-600/10 border border-red-600/30 text-red-400 text-xs font-medium hover:bg-red-600/20 transition disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Limpar erros
            </button>
          )}
          {temConcluidos && (
            <button
              onClick={() => handleLimpar('concluido')}
              disabled={loading === 'limpar'}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-neutral-800 border border-neutral-700 text-gray-400 text-xs font-medium hover:text-white transition disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Limpar concluidos
            </button>
          )}
          {jobs.length > 0 && (
            <button
              onClick={() => handleLimpar('todos')}
              disabled={loading === 'limpar'}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-neutral-800 border border-neutral-700 text-gray-400 text-xs font-medium hover:text-white transition disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Limpar tudo
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {jobs.length === 0 && (
          <p className="text-gray-600 text-xs italic py-4 text-center">Nenhum job recente.</p>
        )}
        {jobs.map((j) => {
          const b = statusBadge(j);
          return (
            <div
              key={j.id}
              className="flex items-center gap-3 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2"
            >
              <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${b.color.split(' ').slice(1).join(' ')}`}>
                <b.Icon className={`w-4 h-4 ${b.color.split(' ')[0]}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{j.url_origem}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {b.label} · {new Date(j.updated_at).toLocaleTimeString('pt-BR')}
                  {j.mensagem_erro ? ` · ${j.mensagem_erro.slice(0, 200)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {j.status === 'erro' && (
                  <button
                    onClick={() => handleReprocessar(j.id)}
                    disabled={loading === j.id}
                    className="p-1.5 rounded hover:bg-neutral-800 text-gray-500 hover:text-white transition"
                    title="Reprocessar"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading === j.id ? 'animate-spin' : ''}`} />
                  </button>
                )}
                {j.status === 'processando' && (
                  <button
                    onClick={() => handleCancelar(j.id)}
                    disabled={loading === j.id}
                    className="p-1.5 rounded hover:bg-neutral-800 text-gray-500 hover:text-red-400 transition"
                    title="Cancelar"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

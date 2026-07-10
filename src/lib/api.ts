import { supabase } from './supabase';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANON}`,
    'apikey': ANON,
  };
}

async function callFunction(body: Record<string, unknown>) {
  const res = await fetch(`${FUNCTIONS_URL}/processar-noticia`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function enfileirarUrls(urls: string[]): Promise<{ ok: boolean; enqueued?: number; skipped?: number; error?: string }> {
  return callFunction({ action: 'enfileirar', urls });
}

export async function limparJobs(filter: 'erro' | 'concluido' | 'todos') {
  await callFunction({ action: 'limpar', filter });
}

export async function cancelarJob(job_id: string) {
  await callFunction({ action: 'cancelar', job_id });
}

export async function reprocessarJob(job_id: string) {
  await callFunction({ action: 'reprocessar', job_id });
}

export async function runWatchdog() {
  return callFunction({ action: 'watchdog' });
}

export async function traduzirDocumento(
  filename: string,
  fileBase64: string,
  idioma: 'en' | 'es'
): Promise<{ ok: boolean; filename?: string; fileBase64?: string; segmentos?: number; error?: string }> {
  const res = await fetch(`${FUNCTIONS_URL}/traduzir-documento`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ filename, fileBase64, idioma }),
  });
  return res.json();
}

export async function getCounts() {
  const [p, a, r] = await Promise.all([
    supabase.from('noticias').select('group_id', { count: 'exact', head: true }).eq('status', 'pendente'),
    supabase.from('noticias').select('group_id', { count: 'exact', head: true }).eq('status', 'aprovado'),
    supabase.from('noticias').select('group_id', { count: 'exact', head: true }).eq('status', 'reprovado'),
  ]);
  return {
    pendente: p.count ?? 0,
    aprovado: a.count ?? 0,
    reprovado: r.count ?? 0,
  };
}

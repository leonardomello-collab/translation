import { supabase } from './supabase';

export async function carregarNoticiaCompleta(group_id: string) {
  const [noticia, versoes, imagens] = await Promise.all([
    supabase.from('noticias').select('*').eq('group_id', group_id).maybeSingle(),
    supabase.from('versoes').select('*').eq('group_id', group_id),
    supabase.from('imagens').select('*').eq('group_id', group_id).order('ordem'),
  ]);

  const versoesMap: Record<string, any> = {};
  (versoes.data ?? []).forEach((v) => {
    versoesMap[v.idioma] = {
      titulo: v.titulo,
      subtitulo: v.subtitulo,
      corpo: v.corpo,
      descricao: v.descricao,
      palavras_chave: v.palavras_chave,
      url_personalizada: v.url_personalizada,
      categoria: v.categoria,
    };
  });

  return {
    group_id,
    url_origem: noticia.data?.url_origem,
    publicado_em: noticia.data?.publicado_em,
    status: noticia.data?.status,
    imagens: (imagens.data ?? []).map((i) => ({ url: i.url, caption: i.caption, role: i.role })),
    versoes: versoesMap,
    notas_extracao: noticia.data?.notas_extracao ?? null,
  };
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function exportarJson(group_id: string) {
  const n = await carregarNoticiaCompleta(group_id);
  download(`${group_id}.json`, JSON.stringify(n, null, 2), 'application/json');
}

function csvEscape(val: any): string {
  if (val === null || val === undefined) return '';
  const s = Array.isArray(val) ? val.join('|') : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportarCsv(group_id: string) {
  const n = await carregarNoticiaCompleta(group_id);
  download(`${group_id}.csv`, buildCsv([n]), 'text/csv');
}

function buildCsv(items: any[]): string {
  const headers = [
    'group_id', 'idioma', 'url_origem', 'publicado_em', 'status',
    'titulo', 'subtitulo', 'corpo', 'descricao', 'palavras_chave',
    'url_personalizada', 'categoria',
  ];
  const rows = [headers.join(',')];
  for (const n of items) {
    for (const [idioma, v] of Object.entries(n.versoes)) {
      const vv: any = v;
      rows.push([
        n.group_id, idioma, n.url_origem, n.publicado_em, n.status,
        vv.titulo, vv.subtitulo, vv.corpo, vv.descricao, vv.palavras_chave,
        vv.url_personalizada, vv.categoria,
      ].map(csvEscape).join(','));
    }
  }
  return rows.join('\n');
}

export async function exportarLoteJson(group_ids: string[]) {
  const items = await Promise.all(group_ids.map((id) => carregarNoticiaCompleta(id)));
  const stamp = new Date().toISOString().slice(0, 10);
  download(`flanews-${stamp}-${items.length}.json`, JSON.stringify(items, null, 2), 'application/json');
}

export async function exportarLoteCsv(group_ids: string[]) {
  const items = await Promise.all(group_ids.map((id) => carregarNoticiaCompleta(id)));
  const stamp = new Date().toISOString().slice(0, 10);
  download(`flanews-${stamp}-${items.length}.csv`, buildCsv(items), 'text/csv');
}

import { supabase } from './supabase';

const SITE_ID = 'flamengo';
const AUTHOR_SLUG = 'Comunicacao Flamengo';
const LOCALES = ['pt-BR', 'en', 'es'] as const;
const CHUNK = 50;

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

// Carrega várias notícias com 2 consultas por lote de 50 ids,
// em vez de 3 consultas por notícia (inviável para exportação em volume).
async function carregarLote(group_ids: string[]) {
  const noticias: any[] = [];
  const versoes: any[] = [];
  for (let i = 0; i < group_ids.length; i += CHUNK) {
    const ids = group_ids.slice(i, i + CHUNK);
    const [nRes, vRes] = await Promise.all([
      supabase.from('noticias').select('*').in('group_id', ids),
      supabase.from('versoes').select('*').in('group_id', ids),
    ]);
    noticias.push(...(nRes.data ?? []));
    versoes.push(...(vRes.data ?? []));
  }

  const vMap = new Map<string, Record<string, any>>();
  versoes.forEach((v) => {
    const m = vMap.get(v.group_id) ?? {};
    m[v.idioma] = v;
    vMap.set(v.group_id, m);
  });

  return group_ids
    .map((id) => {
      const n = noticias.find((x) => x.group_id === id);
      if (!n) return null;
      return {
        group_id: id,
        url_origem: n.url_origem,
        publicado_em: n.publicado_em,
        status: n.status,
        versoes: vMap.get(id) ?? {},
        notas_extracao: n.notas_extracao ?? null,
      };
    })
    .filter(Boolean) as any[];
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  // Revogar depois de um tempo: revogar imediatamente pode abortar
  // downloads disparados em sequência no mesmo tick
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

// Dispara todos os downloads no MESMO instante: o Chrome agrupa a rajada e
// pede permissão de "vários downloads" uma única vez. Com pausas entre os
// cliques, ele bloqueava silenciosamente do segundo arquivo em diante.
function downloadMultiplos(files: { name: string; content: string }[]) {
  for (const f of files) {
    download(f.name, f.content, 'application/json');
  }
}

function slugifyTag(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function corpoParaHtml(corpo: string): string {
  if (/<p[\s>]/i.test(corpo)) return corpo;
  const esc = corpo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join('');
}

// Formata em ISO com offset fixo de Brasília (-03:00), como no formato de publicação.
function publishedAtBrasilia(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const t = new Date(d.getTime() - 3 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}-03:00`;
}

function paraPublicacao(n: any, locale: string, v: any) {
  const slug = v.url_personalizada || '';
  return {
    translationKey: n.group_id,
    locale,
    siteId: SITE_ID,
    legacyId: n.group_id,
    slug: slug && !slug.startsWith('/') ? `/${slug}` : slug,
    title: v.titulo ?? '',
    summary: v.subtitulo || v.descricao || '',
    content: corpoParaHtml(v.corpo ?? ''),
    authorSlug: AUTHOR_SLUG,
    categorySlugs: v.categoria ? [slugifyTag(v.categoria)] : [],
    tagSlugs: (v.palavras_chave ?? []).map(slugifyTag).filter(Boolean),
    seo: {
      metaTitle: v.titulo ?? '',
      metaDescription: v.descricao ?? '',
      keywords: (v.palavras_chave ?? []).join(', '),
    },
    publishedAt: publishedAtBrasilia(n.publicado_em),
  };
}

// Exporta uma notícia: um arquivo por idioma, ex. <group_id>-en.json,
// cada um contendo um array com o objeto no formato de publicação.
export async function exportarJson(group_id: string) {
  const [n] = await carregarLote([group_id]);
  if (!n) return;
  const files = LOCALES.filter((l) => n.versoes[l]).map((l) => ({
    name: `${group_id}-${l}.json`,
    content: JSON.stringify([paraPublicacao(n, l, n.versoes[l])], null, 2),
  }));
  downloadMultiplos(files);
}

// Exporta em volume: um arquivo por idioma com todas as notícias selecionadas.
export async function exportarLoteJson(group_ids: string[]) {
  const items = await carregarLote(group_ids);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const files = LOCALES.map((l) => {
    const objs = items.filter((n) => n.versoes[l]).map((n) => paraPublicacao(n, l, n.versoes[l]));
    return {
      name: `flanews_${stamp}_${items.length}noticias-${l}.json`,
      content: JSON.stringify(objs, null, 2),
    };
  }).filter((f) => f.content !== '[]');
  downloadMultiplos(files);
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
  const items = await carregarLote([group_id]);
  download(`${group_id}.csv`, buildCsv(items), 'text/csv');
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

export async function exportarLoteCsv(group_ids: string[]) {
  const items = await carregarLote(group_ids);
  const stamp = new Date().toISOString().slice(0, 10);
  download(`flanews-${stamp}-${items.length}.csv`, buildCsv(items), 'text/csv');
}

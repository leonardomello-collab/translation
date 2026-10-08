import { supabase, type Imagem, type Versao } from './supabase';
import { sanitizeInline } from './richtext';

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

// Carrega várias notícias com 3 consultas por lote de 50 ids,
// em vez de 3 consultas por notícia (inviável para exportação em volume).
async function carregarLote(group_ids: string[]) {
  const noticias: any[] = [];
  const versoes: any[] = [];
  const imagens: Imagem[] = [];
  for (let i = 0; i < group_ids.length; i += CHUNK) {
    const ids = group_ids.slice(i, i + CHUNK);
    const [nRes, vRes, iRes] = await Promise.all([
      supabase.from('noticias').select('*').in('group_id', ids),
      supabase.from('versoes').select('*').in('group_id', ids),
      supabase.from('imagens').select('*').in('group_id', ids).order('ordem'),
    ]);
    noticias.push(...(nRes.data ?? []));
    versoes.push(...(vRes.data ?? []));
    imagens.push(...(iRes.data ?? []));
  }

  const vMap = new Map<string, Record<string, any>>();
  versoes.forEach((v) => {
    const m = vMap.get(v.group_id) ?? {};
    m[v.idioma] = v;
    vMap.set(v.group_id, m);
  });
  const iMap = new Map<string, Imagem[]>();
  imagens.forEach((i) => {
    iMap.set(i.group_id, [...(iMap.get(i.group_id) ?? []), i]);
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
        imagens: iMap.get(id) ?? [],
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

// Para valores de atributo: aspas precisam virar &quot;.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Para conteudo de texto (paragrafos, figcaption): aspas ficam como estao.
function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Devolve o corpo como lista de blocos. O corpo vem da Tess como texto com
// uma linha por parágrafo, podendo trazer formatação inline (negrito, itálico,
// link) reaplicada na extração; se já vier em blocos HTML, mantém os blocos.
// Em qualquer caminho o conteúdo passa pelo sanitizador: só a formatação da
// lista permitida sobrevive, o resto vira texto.
const BLOCO_RE = /<(p|h[1-6]|ul|ol|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;

function corpoEmParagrafos(corpo: string): string[] {
  if (/<(p|h[1-6]|ul|ol|blockquote)[\s>]/i.test(corpo)) {
    return [...corpo.matchAll(BLOCO_RE)].map((m) => {
      const tag = m[1].toLowerCase();
      return `<${tag}>${sanitizeInline(m[2])}</${tag}>`;
    });
  }
  return corpo
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${sanitizeInline(p)}</p>`);
}

// srcset no padrão que o editor do Strapi grava: a mesma URL repetida nas
// larguras de referência, com vírgula final.
function srcsetPadrao(url: string): string {
  return [117, 375, 562, 750].map((w) => `${url} ${w}w`).join(',') + ',';
}

// Bloco de imagem no formato de importação do Strapi:
// <p><img …><figcaption>…</figcaption></p>
function blocoImagem(img: Imagem): string {
  const at = img.atributos ?? {};
  const attrs = [
    `src="${escapeHtml(img.url)}"`,
    `alt="${escapeHtml(at.alt ?? '')}"`,
    `srcset="${escapeHtml(at.srcset ?? srcsetPadrao(img.url))}"`,
    `sizes="${escapeHtml(at.sizes ?? '100vw')}"`,
    at.width ? `width="${escapeHtml(String(at.width))}"` : '',
    at.height ? `height="${escapeHtml(String(at.height))}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const cap = img.caption ? `<figcaption>${escapeText(img.caption)}</figcaption>` : '';
  return `<p><img ${attrs}>${cap}</p>`;
}

// Monta o bodyRichText: parágrafos do corpo traduzido com as imagens inline
// reinseridas onde estavam na matéria original (campo posicao = quantos
// parágrafos vêm antes). Imagem sem posição conhecida vai para o fim.
function montarBodyRichText(corpo: string, imagens: Imagem[]): string {
  const paras = corpoEmParagrafos(corpo ?? '');
  const inline = imagens
    .filter((i) => i.role === 'inline')
    .map((i, idx) => ({ ...i, _ordem: i.ordem ?? idx }))
    .sort((a, b) => (a.posicao ?? Infinity) - (b.posicao ?? Infinity) || a._ordem - b._ordem);

  const out: string[] = [];
  let cursor = 0;
  for (const img of inline) {
    const alvo = Math.min(img.posicao ?? paras.length, paras.length);
    while (cursor < alvo) out.push(paras[cursor++]);
    out.push(blocoImagem(img));
  }
  while (cursor < paras.length) out.push(paras[cursor++]);
  return out.join('');
}

// Data e hora de publicação em ISO com o fuso de Brasília (-03:00). O banco
// guarda o instante em UTC; o arquivo sai no horário local para conferir sem
// conversão de cabeça. O Brasil não tem horário de verão, então -03:00 é fixo.
function publicadoEmIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const t = new Date(d.getTime() - 3 * 3600 * 1000);
  const z = (n: number) => String(n).padStart(2, '0');
  return (
    `${t.getUTCFullYear()}-${z(t.getUTCMonth() + 1)}-${z(t.getUTCDate())}` +
    `T${z(t.getUTCHours())}:${z(t.getUTCMinutes())}:${z(t.getUTCSeconds())}-03:00`
  );
}

// Objeto no formato de importação do Strapi: { locale, fields: { … } }.
// Campos de OG e Twitter ficam vazios por decisão editorial; a categoria
// não viaja no JSON e é atribuída na importação.
function paraStrapi(locale: string, v: Versao, imagens: Imagem[], publicado_em: string | null) {
  // Só o último trecho do caminho: "news/football/abc-def" -> "abc-def".
  // O prefixo de seção é definido pelo próprio CMS na importação.
  const slug = (v.url_personalizada || '').split('/').filter(Boolean).pop() ?? '';
  return {
    locale,
    fields: {
      title: v.titulo ?? '',
      slug,
      summary: v.subtitulo || v.descricao || '',
      publishedAt: publicadoEmIso(publicado_em),
      bodyRichText: montarBodyRichText(v.corpo ?? '', imagens),
      seo: {
        metaTitle: v.titulo ?? '',
        metaDescription: v.descricao ?? '',
        keywords: (v.palavras_chave ?? []).join(', '),
        ogTitle: '',
        ogDescription: '',
        twitterTitle: '',
        twitterDescription: '',
      },
    },
  };
}

function arquivosDaNoticia(n: {
  group_id: string;
  versoes: Record<string, Versao>;
  imagens: Imagem[];
  publicado_em?: string | null;
}) {
  return LOCALES.filter((l) => n.versoes[l]).map((l) => ({
    name: `${n.group_id}-${l}.json`,
    content: JSON.stringify(paraStrapi(l, n.versoes[l], n.imagens, n.publicado_em ?? null), null, 2),
  }));
}

// Exporta uma notícia: um arquivo por idioma, ex. <group_id>-en.json,
// cada um com um único objeto no formato de importação do Strapi.
export async function exportarJson(group_id: string) {
  const [n] = await carregarLote([group_id]);
  if (!n) return;
  downloadMultiplos(arquivosDaNoticia(n));
}

// Exporta em volume: um arquivo por notícia e por idioma.
export async function exportarLoteJson(group_ids: string[]) {
  const items = await carregarLote(group_ids);
  downloadMultiplos(items.flatMap(arquivosDaNoticia));
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

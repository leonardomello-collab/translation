// O corpo das versões pode trazer formatação inline da matéria original
// (negrito, itálico, links). Aqui ela é normalizada para um conjunto fechado
// de tags antes de ir para o JSON de importação ou para a tela: tudo que não
// está na lista vira texto escapado, então nada de <script>, style ou
// atributo inesperado atravessa.

const TOKEN = /<\/?(?:strong|b|em|i|u|li)\s*>|<br\s*\/?>|<a\s[^>]*>|<\/a\s*>/gi;

const EQUIVALENTE: Record<string, string> = {
  b: 'strong',
  strong: 'strong',
  i: 'em',
  em: 'em',
  u: 'u',
  li: 'li',
};

function escaparTexto(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escaparAtributo(s: string): string {
  return escaparTexto(s).replace(/"/g, '&quot;');
}

// Mantém só as tags da lista; devolve '' para o que deve desaparecer.
// `aAberto` conta links descartados para engolir o </a> correspondente e não
// deixar tag de fechamento solta.
function normalizarTag(tag: string, estado: { linksDescartados: number }): string {
  const t = tag.toLowerCase();
  if (t.startsWith('<br')) return '<br>';
  if (t.startsWith('</a')) {
    if (estado.linksDescartados > 0) {
      estado.linksDescartados--;
      return '';
    }
    return '</a>';
  }
  if (t.startsWith('<a')) {
    const href = tag.match(/href\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/href\s*=\s*'([^']*)'/i)?.[1] ?? '';
    // Só http(s): javascript:, data: e afins ficam como texto sem link.
    if (!/^https?:\/\//i.test(href.trim())) {
      estado.linksDescartados++;
      return '';
    }
    return `<a href="${escaparAtributo(href.trim())}">`;
  }
  const fechando = t.startsWith('</');
  const nome = t.replace(/[<>/\s]/g, '');
  const alvo = EQUIVALENTE[nome];
  if (!alvo) return '';
  return fechando ? `</${alvo}>` : `<${alvo}>`;
}

// Escapa o texto e preserva apenas a formatação inline permitida.
export function sanitizeInline(s: string): string {
  if (!s) return '';
  const estado = { linksDescartados: 0 };
  let out = '';
  let fim = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(s))) {
    out += escaparTexto(s.slice(fim, m.index));
    out += normalizarTag(m[0], estado);
    fim = m.index + m[0].length;
  }
  return out + escaparTexto(s.slice(fim));
}

// Versão em texto puro, para onde a formatação não faz sentido (contadores,
// prévias curtas).
export function semFormatacao(s: string): string {
  return (s ?? '').replace(/<[^>]+>/g, '');
}

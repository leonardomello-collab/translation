import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key);

export type Status = 'pendente' | 'aprovado' | 'reprovado';
export type Idioma = 'pt-BR' | 'en' | 'es';

export interface Noticia {
  group_id: string;
  url_origem: string;
  publicado_em: string | null;
  status: Status;
  notas_extracao: string | null;
  // Alinhamento dominante dos paragrafos na materia em portugues
  alinhamento_corpo: string | null;
  motivo_reprovacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface Versao {
  id: string;
  group_id: string;
  idioma: Idioma;
  titulo: string;
  subtitulo: string | null;
  corpo: string;
  descricao: string;
  palavras_chave: string[];
  url_personalizada: string;
  categoria: string;
  // Titulo curto para banner (highlightTitle no CMS); nulo = usa o titulo normal
  titulo_destaque: string | null;
}

export interface Imagem {
  id: string;
  group_id: string;
  url: string;
  caption: string | null;
  // Legenda traduzida; nulo = usa a legenda em portugues
  caption_en: string | null;
  caption_es: string | null;
  // 'video' cobre <video> do CMS e <iframe> de embed
  role: 'cover' | 'inline' | 'video';
  ordem: number;
  // Quantos blocos de texto precedem a imagem no corpo; null = desconhecido (linhas antigas)
  posicao: number | null;
  atributos: {
    alt?: string | null;
    width?: string | null;
    height?: string | null;
    srcset?: string | null;
    sizes?: string | null;
    // só para role 'video'
    tipo?: string | null;
    mime?: string | null;
    poster?: string | null;
    title?: string | null;
  } | null;
}

export interface ReferenciaTraducao {
  id: string;
  idioma: 'en' | 'es';
  url: string;
  ativo: boolean;
}

export interface JobTraducao {
  id: string;
  url_origem: string;
  group_id: string | null;
  fase: string;
  status: 'fila' | 'processando' | 'concluido' | 'erro';
  mensagem_erro: string | null;
  created_at: string;
  updated_at: string;
}

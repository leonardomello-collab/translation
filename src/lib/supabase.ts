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
}

export interface Imagem {
  id: string;
  group_id: string;
  url: string;
  caption: string | null;
  role: 'cover' | 'inline';
  ordem: number;
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

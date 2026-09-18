import { useEffect, useState } from 'react';
import { X, Copy, Check, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  group_id: string;
  onClose: () => void;
}

interface SeoPt {
  titulo: string;
  descricao: string;
  palavras_chave: string[];
}

// Campos de SEO da versão em português, prontos para colar no CMS.
export function SeoModal({ group_id, onClose }: Props) {
  const [seo, setSeo] = useState<SeoPt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    supabase
      .from('versoes')
      .select('titulo, descricao, palavras_chave')
      .eq('group_id', group_id)
      .eq('idioma', 'pt-BR')
      .maybeSingle()
      .then(({ data }) => {
        if (!ativo) return;
        setSeo(
          data
            ? {
                titulo: data.titulo ?? '',
                descricao: data.descricao ?? '',
                palavras_chave: data.palavras_chave ?? [],
              }
            : null
        );
        setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, [group_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Palavras-chave em sequência, separadas por vírgula (formato do campo keywords do CMS).
  const keywords = (seo?.palavras_chave ?? [])
    .map((k) => k.trim())
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-600/10 flex items-center justify-center">
              <Search className="w-4 h-4 text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">SEO · Português</p>
              <p className="text-white text-sm font-mono truncate">{group_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-800 text-gray-400 hover:text-white transition"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {loading ? (
            <p className="text-gray-500 text-sm">Carregando...</p>
          ) : !seo ? (
            <p className="text-gray-500 text-sm">Versão em português não encontrada.</p>
          ) : (
            <>
              <CampoSeo label="Título para busca" valor={seo.titulo} contador />
              <CampoSeo label="Descrição para busca" valor={seo.descricao} contador multiline />
              <CampoSeo
                label="Palavras-chave"
                valor={keywords}
                hint={`${seo.palavras_chave.length} palavra(s), separadas por vírgula`}
              />
            </>
          )}
        </div>

        <div className="border-t border-neutral-800 bg-neutral-900 px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function CampoSeo({
  label,
  valor,
  hint,
  contador,
  multiline,
}: {
  label: string;
  valor: string;
  hint?: string;
  contador?: boolean;
  multiline?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      // Fallback para contextos sem Clipboard API (http, iframe restrito)
      const ta = document.createElement('textarea');
      ta.value = valor;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <p className="text-[10px] text-gray-600">{hint ?? (contador ? `${valor.length} caracteres` : '')}</p>
      </div>
      <div className="flex items-start gap-2">
        <div
          className={`flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-[13px] text-gray-200 leading-relaxed select-all ${
            multiline ? 'whitespace-pre-wrap' : 'break-words'
          }`}
        >
          {valor || <span className="text-gray-600 italic">—</span>}
        </div>
        <button
          onClick={copiar}
          disabled={!valor}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${
            copiado
              ? 'bg-emerald-600/10 border-emerald-600/40 text-emerald-400'
              : 'bg-neutral-800 border-neutral-700 text-gray-300 hover:text-white hover:bg-neutral-700'
          }`}
          title={`Copiar ${label.toLowerCase()}`}
        >
          {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Globe, Plus, Trash2, Power } from 'lucide-react';
import { supabase, ReferenciaTraducao } from '../lib/supabase';

export function ReferenciasPanel() {
  const [refs, setRefs] = useState<ReferenciaTraducao[]>([]);
  const [novaEn, setNovaEn] = useState('');
  const [novaEs, setNovaEs] = useState('');

  async function carregar() {
    const { data } = await supabase.from('referencias_traducao').select('*').order('created_at');
    setRefs((data ?? []) as ReferenciaTraducao[]);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function adicionar(idioma: 'en' | 'es', url: string) {
    const u = url.trim();
    if (!u) return;
    await supabase.from('referencias_traducao').insert({ idioma, url: u });
    if (idioma === 'en') setNovaEn('');
    else setNovaEs('');
    carregar();
  }

  async function toggle(r: ReferenciaTraducao) {
    await supabase.from('referencias_traducao').update({ ativo: !r.ativo }).eq('id', r.id);
    carregar();
  }

  async function remover(id: string) {
    await supabase.from('referencias_traducao').delete().eq('id', id);
    carregar();
  }

  const en = refs.filter((r) => r.idioma === 'en');
  const es = refs.filter((r) => r.idioma === 'es');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[
        { label: 'Inglês (EN)', items: en, input: novaEn, set: setNovaEn, idioma: 'en' as const },
        { label: 'Espanhol (ES)', items: es, input: novaEs, set: setNovaEs, idioma: 'es' as const },
      ].map((col) => (
        <div key={col.idioma} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-gray-400" />
            <h3 className="text-white font-semibold text-sm">Referências — {col.label}</h3>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              type="url"
              placeholder="https://..."
              value={col.input}
              onChange={(e) => col.set(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') adicionar(col.idioma, col.input);
              }}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
            />
            <button
              onClick={() => adicionar(col.idioma, col.input)}
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {col.items.length === 0 && (
              <p className="text-gray-600 text-xs italic py-2">Nenhuma referência adicionada ainda.</p>
            )}
            {col.items.map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-2 bg-neutral-950 border rounded-lg px-3 py-2 transition ${
                  r.ativo ? 'border-neutral-800' : 'border-neutral-900 opacity-50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${r.ativo ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                <span className="flex-1 text-xs text-gray-300 truncate" title={r.url}>
                  {r.url}
                </span>
                <button
                  onClick={() => toggle(r)}
                  className="text-gray-500 hover:text-amber-400 transition"
                  title={r.ativo ? 'Desativar' : 'Ativar'}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => remover(r.id)}
                  className="text-gray-500 hover:text-red-400 transition"
                  title="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

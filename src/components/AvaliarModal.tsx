import { useEffect, useState } from 'react';
import { X, Check, XCircle, ChevronLeft, ChevronRight, Info, ExternalLink } from 'lucide-react';
import { carregarNoticiaCompleta } from '../lib/export';
import { supabase } from '../lib/supabase';

interface Props {
  group_id: string;
  onClose: () => void;
  onDecidir: () => void;
  onNav?: (dir: -1 | 1) => void;
}

const IDIOMAS: { key: 'pt-BR' | 'en' | 'es'; label: string; flag: string }[] = [
  { key: 'pt-BR', label: 'Português', flag: 'PT-BR' },
  { key: 'en', label: 'English', flag: 'EN' },
  { key: 'es', label: 'Español', flag: 'ES' },
];

export function AvaliarModal({ group_id, onClose, onDecidir, onNav }: Props) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [motivoOpen, setMotivoOpen] = useState(false);
  const [motivo, setMotivo] = useState('');

  async function load() {
    setLoading(true);
    const d = await carregarNoticiaCompleta(group_id);
    setData(d);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [group_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onNav) onNav(-1);
      if (e.key === 'ArrowRight' && onNav) onNav(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNav, onClose]);

  async function aprovar() {
    await supabase
      .from('noticias')
      .update({ status: 'aprovado', motivo_reprovacao: null, updated_at: new Date().toISOString() })
      .eq('group_id', group_id);
    onDecidir();
  }

  async function reprovar() {
    await supabase
      .from('noticias')
      .update({ status: 'reprovado', motivo_reprovacao: motivo || null, updated_at: new Date().toISOString() })
      .eq('group_id', group_id);
    onDecidir();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-stretch">
      <div className="flex-1 flex flex-col bg-neutral-950">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900">
          <div className="flex items-center gap-4 min-w-0">
            {onNav && (
              <div className="flex gap-1">
                <button
                  onClick={() => onNav(-1)}
                  className="p-1.5 rounded hover:bg-neutral-800 text-gray-400"
                  title="Anterior (←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNav(1)}
                  className="p-1.5 rounded hover:bg-neutral-800 text-gray-400"
                  title="Próxima (→)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Avaliação comparativa</p>
              <p className="text-white text-sm font-mono truncate">{group_id}</p>
            </div>
            {data?.url_origem && (
              <a
                href={data.url_origem}
                target="_blank"
                rel="noreferrer"
                className="hidden md:flex items-center gap-1 text-xs text-gray-400 hover:text-white transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                URL de origem
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-800 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !data ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">Carregando...</div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {data.imagens?.length > 0 && (
              <div className="px-6 py-3 border-b border-neutral-800 bg-neutral-900/50 overflow-x-auto">
                <div className="flex gap-2">
                  {data.imagens.map((img: any, i: number) => (
                    <div key={i} className="relative flex-shrink-0">
                      <img
                        src={img.url}
                        alt={img.caption ?? ''}
                        className="h-20 w-auto rounded border border-neutral-800 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      {img.role === 'cover' && (
                        <span className="absolute top-1 left-1 text-[9px] font-bold uppercase tracking-wider bg-red-600 text-white px-1.5 py-0.5 rounded">
                          Capa
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.notas_extracao && (
              <div className="mx-6 mt-3 flex gap-2 items-start bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-200">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{data.notas_extracao}</p>
              </div>
            )}

            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {IDIOMAS.map(({ key, label, flag }) => {
                  const v = data.versoes?.[key];
                  return (
                    <div
                      key={key}
                      className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col"
                    >
                      <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between">
                        <div>
                          <p className="text-white font-semibold text-sm">{label}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{flag}</p>
                        </div>
                        {v?.categoria && (
                          <span className="px-2 py-0.5 bg-neutral-800 text-gray-300 text-[10px] rounded uppercase tracking-wider font-semibold">
                            {v.categoria}
                          </span>
                        )}
                      </div>
                      {!v ? (
                        <div className="p-4 text-xs text-gray-600 italic">Versão não disponível.</div>
                      ) : (
                        <div className="p-4 space-y-4 overflow-auto text-sm">
                          <Field label="Título">
                            <p className="text-white font-semibold leading-snug">{v.titulo || '—'}</p>
                          </Field>
                          <Field label="Subtítulo">
                            {v.subtitulo ? (
                              <p className="text-gray-200 leading-relaxed">{v.subtitulo}</p>
                            ) : (
                              <p className="text-gray-600 italic text-xs">sem subtítulo</p>
                            )}
                          </Field>
                          <Field label="Corpo">
                            <div className="text-gray-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-auto pr-1 text-[13px]">
                              {v.corpo || '—'}
                            </div>
                          </Field>
                          <Field label="Descrição (SEO)">
                            <p className="text-gray-300 text-[13px] leading-relaxed">{v.descricao || '—'}</p>
                            <p className="text-[10px] text-gray-600 mt-1">{(v.descricao || '').length} caracteres</p>
                          </Field>
                          <Field label="Palavras-chave">
                            <div className="flex flex-wrap gap-1.5">
                              {(v.palavras_chave ?? []).map((k: string, i: number) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-neutral-800 text-gray-300 text-[11px] rounded"
                                >
                                  {k}
                                </span>
                              ))}
                              {(v.palavras_chave ?? []).length === 0 && (
                                <p className="text-gray-600 italic text-xs">—</p>
                              )}
                            </div>
                          </Field>
                          <Field label="URL personalizada">
                            <code className="text-[11px] text-red-400 break-all">{v.url_personalizada || '—'}</code>
                          </Field>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-neutral-800 bg-neutral-900 px-6 py-4 flex items-center justify-between gap-3">
              {motivoOpen ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Motivo da reprovação (opcional)..."
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600"
                  />
                  <button
                    onClick={reprovar}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    Confirmar reprovação
                  </button>
                  <button
                    onClick={() => {
                      setMotivoOpen(false);
                      setMotivo('');
                    }}
                    className="px-3 py-2 text-gray-400 hover:text-white text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition"
                  >
                    Fechar
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMotivoOpen(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-red-600 border border-neutral-700 hover:border-red-600 text-white text-sm font-semibold transition"
                    >
                      <XCircle className="w-4 h-4" />
                      Reprovar
                    </button>
                    <button
                      onClick={aprovar}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition shadow-lg shadow-emerald-600/20"
                    >
                      <Check className="w-4 h-4" />
                      Aprovar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

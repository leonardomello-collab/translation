import { Eye, Trash2, Download, FileJson, FileSpreadsheet, ChevronDown, ImageOff, Check } from 'lucide-react';
import { useState } from 'react';

interface Props {
  group_id: string;
  titulo: string;
  categoria: string;
  publicado_em: string | null;
  cover: string | null;
  selecionado?: boolean;
  onToggleSelect?: () => void;
  onAvaliar: () => void;
  onExcluir: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
}

export function NoticiaCard(props: Props) {
  const [openExport, setOpenExport] = useState(false);
  const dt = props.publicado_em ? new Date(props.publicado_em) : null;
  const dateLabel = dt
    ? dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div
      className={`group bg-neutral-900 border rounded-xl overflow-hidden transition ${
        props.selecionado ? 'border-red-600 ring-1 ring-red-600/40' : 'border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <div className="relative aspect-video bg-neutral-950 overflow-hidden">
        {props.onToggleSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onToggleSelect!();
            }}
            className={`absolute top-3 right-3 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center transition ${
              props.selecionado
                ? 'bg-red-600 border-red-600 text-white'
                : 'bg-black/60 border-white/40 hover:border-white text-transparent hover:text-white backdrop-blur'
            }`}
            title={props.selecionado ? 'Desmarcar' : 'Selecionar'}
          >
            <Check className="w-4 h-4" strokeWidth={3} />
          </button>
        )}
        {props.cover ? (
          <img
            src={props.cover}
            alt={props.titulo}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-700">
            <ImageOff className="w-10 h-10" />
          </div>
        )}
        {props.categoria && (
          <span className="absolute top-3 left-3 px-2.5 py-1 bg-red-600/90 text-white text-[10px] font-bold uppercase tracking-wider rounded backdrop-blur">
            {props.categoria}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-white font-semibold leading-snug line-clamp-2 min-h-[3rem]">
          {props.titulo || 'Sem título'}
        </h3>
        <p className="text-gray-500 text-xs mt-2">{dateLabel}</p>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-800">
          <button
            onClick={props.onAvaliar}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition"
          >
            <Eye className="w-3.5 h-3.5" />
            Avaliar
          </button>

          <div className="relative">
            <button
              onClick={() => setOpenExport((v) => !v)}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium transition"
              title="Exportar"
            >
              <Download className="w-3.5 h-3.5" />
              <ChevronDown className="w-3 h-3" />
            </button>
            {openExport && (
              <div className="absolute right-0 bottom-full mb-1 bg-neutral-950 border border-neutral-800 rounded-lg shadow-xl overflow-hidden z-10 min-w-[140px]">
                <button
                  onClick={() => {
                    setOpenExport(false);
                    props.onExportJson();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-white hover:bg-neutral-800 flex items-center gap-2"
                >
                  <FileJson className="w-3.5 h-3.5" /> JSON
                </button>
                <button
                  onClick={() => {
                    setOpenExport(false);
                    props.onExportCsv();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-white hover:bg-neutral-800 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            )}
          </div>

          <button
            onClick={props.onExcluir}
            className="flex items-center justify-center px-3 py-2 rounded-lg bg-neutral-800 hover:bg-red-600 text-gray-400 hover:text-white transition"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

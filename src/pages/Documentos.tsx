import { useRef, useState } from 'react';
import { FileUp, FileText, Loader2, Download, Info, Globe } from 'lucide-react';
import { traduzirDocumento } from '../lib/api';

const MIMES: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const MAX_MB = 15;

export function DocumentosPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [idioma, setIdioma] = useState<'en' | 'es'>('en');
  const [traduzindo, setTraduzindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function selecionar(f: File | null) {
    setErro(null);
    setSucesso(null);
    if (!f) return;
    const ext = f.name.toLowerCase().split('.').pop() ?? '';
    if (!MIMES[ext]) {
      setErro(
        ext === 'pdf'
          ? 'PDF não é suportado: é um formato de layout fixo e não permite reinserir o texto traduzido preservando o visual. Envie o PPTX ou DOCX que deu origem ao PDF.'
          : `Formato .${ext} não suportado. Envie um arquivo .docx ou .pptx.`
      );
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setErro(`Arquivo muito grande (${(f.size / 1024 / 1024).toFixed(1)} MB; limite ${MAX_MB} MB).`);
      return;
    }
    setArquivo(f);
  }

  function lerBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });
  }

  async function traduzir() {
    if (!arquivo || traduzindo) return;
    setTraduzindo(true);
    setErro(null);
    setSucesso(null);
    try {
      const fileBase64 = await lerBase64(arquivo);
      const result = await traduzirDocumento(arquivo.name, fileBase64, idioma);
      if (!result.ok || !result.fileBase64 || !result.filename) {
        setErro(result.error ?? 'Erro desconhecido ao traduzir o documento.');
        return;
      }
      const bin = atob(result.fileBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const ext = result.filename.toLowerCase().split('.').pop() ?? '';
      const blob = new Blob([bytes], { type: MIMES[ext] ?? 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(a.href);
      setSucesso(
        `Documento traduzido com sucesso (${result.segmentos ?? '?'} trechos). O download de "${result.filename}" começou.`
      );
    } catch (e: any) {
      setErro(`Erro: ${String(e?.message ?? e)}`);
    } finally {
      setTraduzindo(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Tradução de Documentos</h2>
        <p className="text-gray-400 text-sm mt-1">
          Envie um arquivo .docx ou .pptx e receba o mesmo arquivo, com o mesmo layout, traduzido
          para inglês ou espanhol usando as referências de tom cadastradas.
        </p>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          selecionar(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        className="bg-neutral-900 border-2 border-dashed border-neutral-700 hover:border-red-600/60 rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.pptx"
          className="hidden"
          onChange={(e) => selecionar(e.target.files?.[0] ?? null)}
        />
        {arquivo ? (
          <>
            <FileText className="w-10 h-10 text-red-500 mb-3" />
            <p className="text-white font-medium text-sm">{arquivo.name}</p>
            <p className="text-gray-500 text-xs mt-1">
              {(arquivo.size / 1024 / 1024).toFixed(2)} MB · clique para trocar o arquivo
            </p>
          </>
        ) : (
          <>
            <FileUp className="w-10 h-10 text-gray-600 mb-3" />
            <p className="text-gray-300 font-medium text-sm">
              Arraste um arquivo aqui ou clique para selecionar
            </p>
            <p className="text-gray-600 text-xs mt-1">.docx ou .pptx · até {MAX_MB} MB</p>
          </>
        )}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300 font-medium">Traduzir para:</span>
          <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-800 rounded-lg p-1">
            {(['en', 'es'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setIdioma(l)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${
                  idioma === l ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {l === 'en' ? 'Inglês (EN)' : 'Espanhol (ES)'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={traduzir}
          disabled={!arquivo || traduzindo}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-neutral-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition shadow-lg shadow-red-600/20"
        >
          {traduzindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {traduzindo ? 'Traduzindo... isso pode levar alguns minutos' : 'Traduzir e baixar'}
        </button>
      </div>

      {erro && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-300">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-sm text-emerald-300">
          {sucesso}
        </div>
      )}

      <div className="flex gap-2 items-start bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-xs text-gray-400">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-500" />
        <div className="space-y-1">
          <p>
            A tradução substitui apenas o texto do documento — imagens, cores, fontes e
            posicionamento são preservados. Textos traduzidos podem ficar maiores ou menores que o
            original, então vale revisar quebras de linha em slides muito cheios.
          </p>
          <p>
            <span className="text-gray-300 font-medium">Por que PDF não?</span> PDF é um formato de
            layout fixo: o texto é posicionado por coordenadas e as fontes são embutidas apenas com
            os caracteres usados. Não há como reinserir texto novo mantendo o visual. Envie o
            arquivo original (.pptx ou .docx) que gerou o PDF.
          </p>
        </div>
      </div>
    </div>
  );
}

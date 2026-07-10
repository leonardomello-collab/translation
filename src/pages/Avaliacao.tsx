import { useEffect, useMemo, useState } from 'react';
import { Search, Inbox, CheckSquare, Square, Trash2, FileJson, FileSpreadsheet, Filter, X } from 'lucide-react';
import { supabase, Status } from '../lib/supabase';
import { NoticiaCard } from '../components/NoticiaCard';
import { AvaliarModal } from '../components/AvaliarModal';
import { exportarJson, exportarCsv, exportarLoteJson, exportarLoteCsv } from '../lib/export';

interface Row {
  group_id: string;
  titulo: string;
  categoria: string;
  publicado_em: string | null;
  cover: string | null;
}

type Counts = Record<Status, number>;
type SortKey = 'recent' | 'oldest' | 'title';

export function AvaliacaoPage() {
  const [tab, setTab] = useState<Status>('pendente');
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Counts>({ pendente: 0, aprovado: 0, reprovado: 0 });
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [avaliando, setAvaliando] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  async function carregar() {
    setLoading(true);

    const { data: noticias } = await supabase
      .from('noticias')
      .select('group_id, publicado_em, status')
      .eq('status', tab)
      .order('created_at', { ascending: false });

    const ids = (noticias ?? []).map((n) => n.group_id);

    const [versoesRes, imagensRes, countsRes] = await Promise.all([
      ids.length
        ? supabase.from('versoes').select('group_id, titulo, categoria').eq('idioma', 'pt-BR').in('group_id', ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase.from('imagens').select('group_id, url, role, ordem').in('group_id', ids).order('ordem')
        : Promise.resolve({ data: [] as any[] }),
      Promise.all([
        supabase.from('noticias').select('group_id', { count: 'exact', head: true }).eq('status', 'pendente'),
        supabase.from('noticias').select('group_id', { count: 'exact', head: true }).eq('status', 'aprovado'),
        supabase.from('noticias').select('group_id', { count: 'exact', head: true }).eq('status', 'reprovado'),
      ]),
    ]);

    const vMap = new Map<string, any>();
    (versoesRes.data ?? []).forEach((v: any) => vMap.set(v.group_id, v));
    const iMap = new Map<string, string>();
    (imagensRes.data ?? []).forEach((i: any) => {
      if (!iMap.has(i.group_id) || i.role === 'cover') iMap.set(i.group_id, i.url);
    });

    const merged: Row[] = (noticias ?? []).map((n: any) => ({
      group_id: n.group_id,
      titulo: vMap.get(n.group_id)?.titulo ?? '',
      categoria: vMap.get(n.group_id)?.categoria ?? '',
      publicado_em: n.publicado_em,
      cover: iMap.get(n.group_id) ?? null,
    }));

    setRows(merged);
    setCounts({
      pendente: countsRes[0].count ?? 0,
      aprovado: countsRes[1].count ?? 0,
      reprovado: countsRes[2].count ?? 0,
    });
    setSelecionados(new Set());
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel('avaliacao-ch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'noticias' }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [tab]);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.categoria && set.add(r.categoria));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 86400000 : null;
    const list = rows.filter((r) => {
      if (s && !r.titulo.toLowerCase().includes(s) && !r.categoria.toLowerCase().includes(s)) return false;
      if (categoria && r.categoria !== categoria) return false;
      if (from || to) {
        const t = r.publicado_em ? new Date(r.publicado_em).getTime() : null;
        if (t === null) return false;
        if (from && t < from) return false;
        if (to && t >= to) return false;
      }
      return true;
    });
    if (sort === 'oldest') {
      list.sort((a, b) => (a.publicado_em ?? '').localeCompare(b.publicado_em ?? ''));
    } else if (sort === 'title') {
      list.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
    } else {
      list.sort((a, b) => (b.publicado_em ?? '').localeCompare(a.publicado_em ?? ''));
    }
    return list;
  }, [rows, search, categoria, dateFrom, dateTo, sort]);

  async function excluir(group_id: string) {
    if (!confirm('Tem certeza que deseja excluir esta notícia? Esta ação não pode ser desfeita.')) return;
    await supabase.from('noticias').delete().eq('group_id', group_id);
    carregar();
  }

  async function excluirLote() {
    const ids = Array.from(selecionados);
    if (!ids.length) return;
    if (!confirm(`Excluir ${ids.length} notícia(s) selecionada(s)? Esta ação não pode ser desfeita.`)) return;
    await supabase.from('noticias').delete().in('group_id', ids);
    setSelecionados(new Set());
    carregar();
  }

  function toggleSelecao(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selecionarTodos() {
    if (selecionados.size === filtered.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(filtered.map((r) => r.group_id)));
    }
  }

  function limparFiltros() {
    setSearch('');
    setCategoria('');
    setDateFrom('');
    setDateTo('');
    setSort('recent');
  }

  function navigate(dir: -1 | 1) {
    if (!avaliando) return;
    const idx = filtered.findIndex((r) => r.group_id === avaliando);
    if (idx === -1) return;
    const next = filtered[idx + dir];
    if (next) setAvaliando(next.group_id);
  }

  const tabs: { key: Status; label: string }[] = [
    { key: 'pendente', label: 'Pendentes' },
    { key: 'aprovado', label: 'Aprovadas' },
    { key: 'reprovado', label: 'Reprovadas' },
  ];

  const hasFiltros = !!(search || categoria || dateFrom || dateTo || sort !== 'recent');
  const selCount = selecionados.size;
  const todosSelecionados = filtered.length > 0 && selCount === filtered.length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Avaliação de Traduções</h2>
        <p className="text-gray-400 text-sm mt-1">
          Compare lado a lado as versões em português, inglês e espanhol.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
          {tabs.map((t) => {
            const active = tab === t.key;
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                  active ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t.label}
                <span
                  className={`min-w-[22px] px-1.5 py-0.5 rounded text-[11px] font-bold tabular-nums ${
                    active ? 'bg-white/20 text-white' : 'bg-neutral-800 text-gray-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-1 lg:justify-end">
          <div className="relative flex-1 lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por título ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition ${
              showFilters || hasFiltros
                ? 'bg-red-600/10 border-red-600/40 text-red-400'
                : 'bg-neutral-900 border-neutral-800 text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {hasFiltros && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">
              Categoria
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-600"
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">
              Publicado de
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-600"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">
              Publicado até
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-600"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">
              Ordenar por
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-600"
            >
              <option value="recent">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
              <option value="title">Título (A–Z)</option>
            </select>
          </div>
          {hasFiltros && (
            <div className="md:col-span-4 flex justify-end">
              <button
                onClick={limparFiltros}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" /> Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={selecionarTodos}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
          >
            {todosSelecionados ? (
              <CheckSquare className="w-4 h-4 text-red-500" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
          <span className="text-xs text-gray-500">
            {filtered.length} notícia{filtered.length === 1 ? '' : 's'}
            {selCount > 0 ? ` · ${selCount} selecionada${selCount === 1 ? '' : 's'}` : ''}
          </span>
        </div>
        {selCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportarLoteJson(Array.from(selecionados))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-xs font-medium transition"
            >
              <FileJson className="w-3.5 h-3.5" />
              Exportar JSON
            </button>
            <button
              onClick={() => exportarLoteCsv(Array.from(selecionados))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-xs font-medium transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
            <button
              onClick={excluirLote}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir selecionadas
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-neutral-800" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-neutral-800 rounded w-3/4" />
                <div className="h-3 bg-neutral-800 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 border-dashed rounded-xl py-16 flex flex-col items-center justify-center text-center">
          <Inbox className="w-10 h-10 text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">Nenhuma notícia encontrada</p>
          <p className="text-gray-600 text-sm mt-1">
            {hasFiltros
              ? 'Tente ajustar os filtros aplicados.'
              : tab === 'pendente'
              ? 'Envie URLs na página de Ingestão para começar.'
              : 'Avalie notícias pendentes para popular esta aba.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <NoticiaCard
              key={r.group_id}
              {...r}
              selecionado={selecionados.has(r.group_id)}
              onToggleSelect={() => toggleSelecao(r.group_id)}
              onAvaliar={() => setAvaliando(r.group_id)}
              onExcluir={() => excluir(r.group_id)}
              onExportJson={() => exportarJson(r.group_id)}
              onExportCsv={() => exportarCsv(r.group_id)}
            />
          ))}
        </div>
      )}

      {avaliando && (
        <AvaliarModal
          group_id={avaliando}
          onClose={() => setAvaliando(null)}
          onDecidir={() => {
            setAvaliando(null);
            carregar();
          }}
          onNav={navigate}
        />
      )}
    </div>
  );
}

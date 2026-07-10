import { Clock, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  pendente: number;
  aprovado: number;
  reprovado: number;
}

export function MetricsCards({ pendente, aprovado, reprovado }: Props) {
  const cards = [
    { label: 'Pendentes', value: pendente, Icon: Clock, color: 'amber', ring: 'ring-amber-500/20', text: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Aprovadas', value: aprovado, Icon: CheckCircle2, color: 'emerald', ring: 'ring-emerald-500/20', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Reprovadas', value: reprovado, Icon: XCircle, color: 'red', ring: 'ring-red-500/20', text: 'text-red-400', bg: 'bg-red-500/10' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`bg-neutral-900 border border-neutral-800 rounded-xl p-5 ring-1 ${c.ring} transition hover:border-neutral-700`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium">{c.label}</p>
              <p className="text-4xl font-bold text-white mt-2 tabular-nums">{c.value}</p>
            </div>
            <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
              <c.Icon className={`w-5 h-5 ${c.text}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

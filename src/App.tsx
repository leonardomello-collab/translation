import { useState } from 'react';
import { Header } from './components/Header';
import { IngestaoPage } from './pages/Ingestao';
import { AvaliacaoPage } from './pages/Avaliacao';

function App() {
  const [page, setPage] = useState<'ingestao' | 'avaliacao'>('ingestao');
  return (
    <div className="min-h-screen bg-neutral-950">
      <Header page={page} onChange={setPage} />
      {page === 'ingestao' ? <IngestaoPage /> : <AvaliacaoPage />}
    </div>
  );
}

export default App;

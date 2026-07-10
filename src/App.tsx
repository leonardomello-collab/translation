import { useState } from 'react';
import { Header, Page } from './components/Header';
import { IngestaoPage } from './pages/Ingestao';
import { AvaliacaoPage } from './pages/Avaliacao';
import { DocumentosPage } from './pages/Documentos';

function App() {
  const [page, setPage] = useState<Page>('ingestao');
  return (
    <div className="min-h-screen bg-neutral-950">
      <Header page={page} onChange={setPage} />
      {page === 'ingestao' && <IngestaoPage />}
      {page === 'avaliacao' && <AvaliacaoPage />}
      {page === 'documentos' && <DocumentosPage />}
    </div>
  );
}

export default App;

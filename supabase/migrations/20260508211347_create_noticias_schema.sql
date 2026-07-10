/*
  # Schema da Plataforma de Tradução de Notícias

  ## Descrição
  Cria as tabelas necessárias para a plataforma de extração, tradução e avaliação
  de notícias do Flamengo nos idiomas pt-BR, en e es.

  ## 1. Novas Tabelas

  ### `noticias`
  Tabela principal com dados compartilhados entre todas as versões de idioma.
  - `group_id` (text, PK): ID determinístico no formato flanews_YYYYMMDD_slug_hash6
  - `url_origem` (text): URL original da notícia
  - `publicado_em` (timestamptz): Data de publicação
  - `status` (text): pendente | aprovado | reprovado
  - `notas_extracao` (text, nullable): Notas sobre ajustes feitos durante extração/tradução
  - `motivo_reprovacao` (text, nullable): Motivo opcional quando reprovada
  - `created_at`, `updated_at` (timestamptz)

  ### `versoes`
  Uma linha por idioma, com o conteúdo editorial.
  - `id` (uuid, PK)
  - `group_id` (text, FK noticias)
  - `idioma` (text): pt-BR | en | es
  - `titulo`, `subtitulo`, `corpo`, `descricao`, `url_personalizada`, `categoria` (text)
  - `palavras_chave` (text[])

  ### `imagens`
  Imagens editoriais da notícia.
  - `id` (uuid, PK)
  - `group_id` (text, FK noticias)
  - `url`, `caption` (text)
  - `role` (text): cover | inline
  - `ordem` (int)

  ### `referencias_traducao`
  URLs de referência reutilizáveis para calibragem de tom.
  - `id` (uuid, PK)
  - `idioma` (text): en | es
  - `url` (text)
  - `ativo` (bool)

  ### `jobs_traducao`
  Telemetria do pipeline (extração + tradução).
  - `id` (uuid, PK)
  - `url_origem` (text), `group_id` (text, nullable)
  - `fase` (text): extracao | traducao
  - `status` (text): fila | processando | concluido | erro
  - `mensagem_erro` (text, nullable)
  - timestamps

  ## 2. Segurança
  - RLS habilitado em todas as tabelas.
  - A plataforma é de uso interno sem autenticação — políticas permitem acesso anônimo completo,
    visto que todo o acesso passa pelo cliente público sem dados sensíveis de usuários.

  ## 3. Notas Importantes
  1. `group_id` é reutilizado entre versões para agrupar a mesma notícia em idiomas diferentes.
  2. Restrição única (group_id, idioma) em `versoes` garante uma versão por idioma.
  3. ON DELETE CASCADE em versoes e imagens mantém consistência ao excluir notícias.
*/

CREATE TABLE IF NOT EXISTS noticias (
  group_id text PRIMARY KEY,
  url_origem text NOT NULL,
  publicado_em timestamptz,
  status text NOT NULL DEFAULT 'pendente',
  notas_extracao text,
  motivo_reprovacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id text NOT NULL REFERENCES noticias(group_id) ON DELETE CASCADE,
  idioma text NOT NULL,
  titulo text NOT NULL DEFAULT '',
  subtitulo text,
  corpo text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  palavras_chave text[] NOT NULL DEFAULT '{}',
  url_personalizada text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, idioma)
);

CREATE TABLE IF NOT EXISTS imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id text NOT NULL REFERENCES noticias(group_id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  role text NOT NULL DEFAULT 'inline',
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referencias_traducao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idioma text NOT NULL,
  url text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs_traducao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url_origem text NOT NULL,
  group_id text,
  fase text NOT NULL DEFAULT 'extracao',
  status text NOT NULL DEFAULT 'fila',
  mensagem_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_noticias_status ON noticias(status);
CREATE INDEX IF NOT EXISTS idx_noticias_publicado_em ON noticias(publicado_em DESC);
CREATE INDEX IF NOT EXISTS idx_versoes_group ON versoes(group_id, idioma);
CREATE INDEX IF NOT EXISTS idx_imagens_group ON imagens(group_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs_traducao(status);
CREATE INDEX IF NOT EXISTS idx_refs_idioma_ativo ON referencias_traducao(idioma, ativo);

ALTER TABLE noticias ENABLE ROW LEVEL SECURITY;
ALTER TABLE versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE imagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE referencias_traducao ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs_traducao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select noticias" ON noticias FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert noticias" ON noticias FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update noticias" ON noticias FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete noticias" ON noticias FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can select versoes" ON versoes FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert versoes" ON versoes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update versoes" ON versoes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete versoes" ON versoes FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can select imagens" ON imagens FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert imagens" ON imagens FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update imagens" ON imagens FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete imagens" ON imagens FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can select referencias" ON referencias_traducao FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert referencias" ON referencias_traducao FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update referencias" ON referencias_traducao FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete referencias" ON referencias_traducao FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can select jobs" ON jobs_traducao FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert jobs" ON jobs_traducao FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update jobs" ON jobs_traducao FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete jobs" ON jobs_traducao FOR DELETE TO anon USING (true);

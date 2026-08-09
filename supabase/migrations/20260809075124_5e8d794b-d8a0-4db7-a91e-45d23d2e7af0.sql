ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS paper_title text;
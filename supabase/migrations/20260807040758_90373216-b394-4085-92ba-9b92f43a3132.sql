DROP POLICY IF EXISTS "owner can view documents" ON public.documents;
CREATE POLICY "owner can view documents" ON public.documents FOR SELECT TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "owner can view versions" ON public.document_versions;
CREATE POLICY "owner can view versions" ON public.document_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_versions.document_id AND d.owner_id = auth.uid()));

DROP POLICY IF EXISTS "owner can view analyses" ON public.analyses;
CREATE POLICY "owner can view analyses" ON public.analyses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = analyses.document_id AND d.owner_id = auth.uid()));
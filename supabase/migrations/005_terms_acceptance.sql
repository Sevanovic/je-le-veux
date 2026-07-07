-- ══════════════════════════════════════════════════════
-- Je Le Veux — Sprint 5b : Traçabilité acceptation CGU (RGPD)
-- ══════════════════════════════════════════════════════
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ou via supabase db push

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- Index pour audits RGPD (récupérer rapidement les utilisateurs
-- ayant accepté les CGU avant/après une date donnée)
CREATE INDEX IF NOT EXISTS idx_profiles_terms_accepted_at
  ON public.profiles(terms_accepted_at);

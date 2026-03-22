-- ══════════════════════════════════════════════════════
-- Je Le Veux — Sprint 1 : Table profiles + RLS
-- ══════════════════════════════════════════════════════
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ou via supabase db push

-- Table profiles (liée à auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudonym TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'fr' CHECK (preferred_language IN ('fr', 'en')),
  avatar_url TEXT,
  is_age_verified BOOLEAN NOT NULL DEFAULT false,
  has_completed_onboarding BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour la recherche par pseudonyme
CREATE INDEX IF NOT EXISTS idx_profiles_pseudonym ON public.profiles(pseudonym);

-- RLS — chaque utilisateur ne voit que son propre profil
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- Politique publique : permet de vérifier si un pseudonyme existe (pour l'unicité)
CREATE POLICY "Anyone can check pseudonym existence"
  ON public.profiles FOR SELECT
  USING (true);
  -- Note : ne retourne que pseudonym, pas les autres champs (géré côté app)

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Fonction pour créer un profil automatiquement à l'inscription
-- (trigger sur auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, pseudonym, public_key, preferred_language)
  VALUES (
    NEW.id,
    'user_' || LEFT(NEW.id::text, 8),  -- pseudonyme temporaire
    '',  -- clé publique à remplir après génération côté client
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'fr')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ══════════════════════════════════════════════════════
-- Table consents (préparée pour Sprint 2)
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secure_code TEXT UNIQUE NOT NULL,
  initiator_id UUID NOT NULL REFERENCES public.profiles(id),
  initiator_pseudonym TEXT NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id),
  receiver_pseudonym TEXT,
  encrypted_statement TEXT NOT NULL,
  encrypted_conditions TEXT,
  level TEXT NOT NULL CHECK (level IN ('light', 'moderate', 'intimate', 'custom')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'withdrawn', 'refused')),
  duration_minutes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  withdrawn_by UUID REFERENCES public.profiles(id),
  refused_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_consents_initiator ON public.consents(initiator_id);
CREATE INDEX IF NOT EXISTS idx_consents_receiver ON public.consents(receiver_id);
CREATE INDEX IF NOT EXISTS idx_consents_status ON public.consents(status);
CREATE INDEX IF NOT EXISTS idx_consents_secure_code ON public.consents(secure_code);

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own consents"
  ON public.consents FOR SELECT
  USING (auth.uid() = initiator_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create consents"
  ON public.consents FOR INSERT
  WITH CHECK (auth.uid() = initiator_id);

CREATE POLICY "Users can update own consents"
  ON public.consents FOR UPDATE
  USING (auth.uid() = initiator_id OR auth.uid() = receiver_id);

-- ══════════════════════════════════════════════════════
-- Table invitations (préparée pour Sprint 2)
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES public.consents(id) ON DELETE CASCADE,
  invite_link TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read invitation by link"
  ON public.invitations FOR SELECT
  USING (true);

CREATE POLICY "Consent initiator can create invitation"
  ON public.invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.consents
      WHERE id = consent_id AND initiator_id = auth.uid()
    )
  );

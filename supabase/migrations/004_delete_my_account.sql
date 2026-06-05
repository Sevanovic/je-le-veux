-- ══════════════════════════════════════════════════════
-- Je Le Veux — Sprint 5a : RPC pour suppression de compte (GDPR)
-- ══════════════════════════════════════════════════════
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ou via supabase db push

-- ──────────────────────────────────────────────────────
-- delete_my_account()
-- Supprime l'utilisateur courant (auth.uid()) depuis auth.users.
-- Les profils, consents et invitations suivent automatiquement
-- via les FK ON DELETE CASCADE définies dans 001_initial_schema.sql.
--
-- SECURITY DEFINER : la fonction s'exécute avec les droits du
-- propriétaire (postgres), ce qui permet le DELETE sur auth.users
-- alors que le client n'a que les droits authenticated.
-- ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- Verrouille l'accès : seul un utilisateur authentifié peut l'appeler
REVOKE ALL ON FUNCTION public.delete_my_account() FROM public;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- ══════════════════════════════════════════════════════
-- Je Le Veux — Sprint 3 : RLS pour acceptation + Realtime
-- ══════════════════════════════════════════════════════
-- À exécuter dans le SQL Editor de Supabase Dashboard
-- ou via supabase db push

-- ──────────────────────────────────────────────────────
-- Consents — autoriser un utilisateur authentifié à lire
-- un consent en PENDING (donc sans receiver_id) si on a
-- son secure_code (toujours fourni dans la requête).
-- ──────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can read pending consents"
  ON public.consents FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND status = 'pending'
    AND receiver_id IS NULL
  );

-- ──────────────────────────────────────────────────────
-- Consents — autoriser un destinataire potentiel à
-- s'inscrire comme receiver d'un consent PENDING.
-- (Update vers status = active avec receiver_id = self)
-- ──────────────────────────────────────────────────────
CREATE POLICY "Receiver can accept pending consent"
  ON public.consents FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND status = 'pending'
    AND receiver_id IS NULL
  )
  WITH CHECK (
    receiver_id = auth.uid()
  );

-- ──────────────────────────────────────────────────────
-- Invitations — autoriser tout utilisateur authentifié
-- à marquer une invitation comme used.
-- (Justifié : seul un destinataire qui passe par le code
-- peut accéder au flux d'acceptation/refus)
-- ──────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can mark invitation as used"
  ON public.invitations FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ──────────────────────────────────────────────────────
-- Realtime — activer pour consents
-- Permet à App.tsx de recevoir les UPDATE en live
-- ──────────────────────────────────────────────────────
ALTER TABLE public.consents REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.consents;

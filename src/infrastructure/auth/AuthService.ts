import { supabase } from '../api/supabase';
import { SupportedLanguage } from '../../domain/enums';
import type { User } from '../../domain/entities';

export interface SignUpParams {
  email: string;
  password: string;
  pseudonym: string;
  preferredLanguage: SupportedLanguage;
}

export interface SignInParams {
  email: string;
  password: string;
}

/**
 * Service d'authentification — encapsule les appels Supabase Auth.
 *
 * Flux supportés :
 * - Email + mot de passe (inscription + connexion)
 * - Magic link (lien envoyé par email)
 * - Récupération de session persistée
 */
export class AuthService {
  /**
   * Inscription par email + mot de passe.
   * Crée l'utilisateur dans auth.users, le trigger Supabase crée le profil.
   */
  async signUp({ email, password, pseudonym, preferredLanguage }: SignUpParams) {
    // Vérifier que le pseudonyme est disponible
    const { data: existing } = await supabase
      .from('profiles')
      .select('pseudonym')
      .eq('pseudonym', pseudonym)
      .maybeSingle();

    if (existing) {
      throw new Error('PSEUDONYM_TAKEN');
    }

    // Créer le compte
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          pseudonym,
          preferred_language: preferredLanguage,
        },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('SIGNUP_FAILED');

    // Mettre à jour le profil avec le vrai pseudonyme
    await supabase
      .from('profiles')
      .update({
        pseudonym,
        preferred_language: preferredLanguage,
      })
      .eq('id', data.user.id);

    return data;
  }

  /**
   * Connexion par email + mot de passe.
   */
  async signIn({ email, password }: SignInParams) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  /**
   * Envoi d'un magic link par email.
   */
  async sendMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) throw error;
  }

  /**
   * Déconnexion.
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Récupère la session courante (persistée via AsyncStorage).
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  /**
   * Récupère le profil complet depuis la table profiles.
   */
  async getProfile(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      pseudonym: data.pseudonym,
      email: '', // L'email vient de auth.users, pas de profiles
      publicKey: data.public_key,
      preferredLanguage: data.preferred_language as SupportedLanguage,
      isAgeVerified: data.is_age_verified,
      createdAt: new Date(data.created_at),
      avatarUrl: data.avatar_url ?? undefined,
    };
  }

  /**
   * Met à jour le profil utilisateur.
   */
  async updateProfile(
    userId: string,
    updates: {
      pseudonym?: string;
      preferredLanguage?: SupportedLanguage;
      publicKey?: string;
      isAgeVerified?: boolean;
      hasCompletedOnboarding?: boolean;
      avatarUrl?: string;
    },
  ) {
    const mappedUpdates: Record<string, unknown> = {};
    if (updates.pseudonym !== undefined) mappedUpdates.pseudonym = updates.pseudonym;
    if (updates.preferredLanguage !== undefined) mappedUpdates.preferred_language = updates.preferredLanguage;
    if (updates.publicKey !== undefined) mappedUpdates.public_key = updates.publicKey;
    if (updates.isAgeVerified !== undefined) mappedUpdates.is_age_verified = updates.isAgeVerified;
    if (updates.hasCompletedOnboarding !== undefined) mappedUpdates.has_completed_onboarding = updates.hasCompletedOnboarding;
    if (updates.avatarUrl !== undefined) mappedUpdates.avatar_url = updates.avatarUrl;

    const { error } = await supabase
      .from('profiles')
      .update(mappedUpdates)
      .eq('id', userId);

    if (error) throw error;
  }

  /**
   * Supprime le compte (RGPD).
   * Note : la suppression de auth.users cascade vers profiles.
   */
  async deleteAccount() {
    // Supabase ne permet pas l'auto-suppression via le client.
    // Il faut une Edge Function pour ça (Sprint 5).
    // Pour l'instant on déconnecte simplement.
    await this.signOut();
  }

  /**
   * Écoute les changements d'état d'auth (login, logout, token refresh).
   */
  onAuthStateChange(
    callback: (event: string, session: unknown) => void,
  ) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

export const authService = new AuthService();

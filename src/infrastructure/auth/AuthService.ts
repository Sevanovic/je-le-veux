import { supabase } from '../api/supabase';
import type { IAuthService } from '../../domain/interfaces';
import type { User } from '../../domain/entities';
import type { SupportedLanguage } from '../../domain/enums';

/**
 * Supabase implementation of IAuthService.
 *
 * Supported flows:
 * - Email + password (sign up + sign in)
 * - Magic link (passwordless via email)
 * - Session persistence (via AsyncStorage)
 */
export class AuthService implements IAuthService {
  async signUp(params: {
    email: string;
    password: string;
    pseudonym: string;
    preferredLanguage: SupportedLanguage;
  }): Promise<{ userId: string }> {
    // Check pseudonym availability
    const { data: existing } = await supabase
      .from('profiles')
      .select('pseudonym')
      .eq('pseudonym', params.pseudonym)
      .maybeSingle();

    if (existing) {
      throw new Error('PSEUDONYM_TAKEN');
    }

    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          pseudonym: params.pseudonym,
          preferred_language: params.preferredLanguage,
        },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('SIGNUP_FAILED');

    // Update profile with real pseudonym (DB trigger creates a temp one)
    await supabase
      .from('profiles')
      .update({
        pseudonym: params.pseudonym,
        preferred_language: params.preferredLanguage,
      })
      .eq('id', data.user.id);

    return { userId: data.user.id };
  }

  async signIn(params: {
    email: string;
    password: string;
  }): Promise<{ userId: string }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    });

    if (error) throw error;
    if (!data.user) throw new Error('SIGNIN_FAILED');

    return { userId: data.user.id };
  }

  async sendMagicLink(email: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async getSession(): Promise<{ userId: string } | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) return null;
    return { userId: data.session.user.id };
  }

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
      email: '',
      publicKey: data.public_key,
      preferredLanguage: data.preferred_language as SupportedLanguage,
      isAgeVerified: data.is_age_verified,
      createdAt: new Date(data.created_at),
      avatarUrl: data.avatar_url ?? undefined,
      termsAcceptedAt: data.terms_accepted_at ? new Date(data.terms_accepted_at) : undefined,
    };
  }

  async updateProfile(userId: string, updates: Partial<User>): Promise<void> {
    const mapped: Record<string, unknown> = {};
    if (updates.pseudonym !== undefined) mapped.pseudonym = updates.pseudonym;
    if (updates.preferredLanguage !== undefined) mapped.preferred_language = updates.preferredLanguage;
    if (updates.publicKey !== undefined) mapped.public_key = updates.publicKey;
    if (updates.isAgeVerified !== undefined) mapped.is_age_verified = updates.isAgeVerified;
    if (updates.avatarUrl !== undefined) mapped.avatar_url = updates.avatarUrl;
    if (updates.termsAcceptedAt !== undefined) {
      mapped.terms_accepted_at = updates.termsAcceptedAt instanceof Date
        ? updates.termsAcceptedAt.toISOString()
        : updates.termsAcceptedAt;
    }

    const { error } = await supabase
      .from('profiles')
      .update(mapped)
      .eq('id', userId);

    if (error) throw error;
  }

  async deleteCurrentAccount(): Promise<void> {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
  }

  onAuthStateChange(
    callback: (event: string, userId: string | null) => void,
  ): { unsubscribe: () => void } {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        callback(event, session?.user?.id ?? null);
      },
    );
    return { unsubscribe: () => subscription.unsubscribe() };
  }
}

export const authService = new AuthService();

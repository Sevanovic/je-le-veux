import { supabase } from '../api/supabase';
import type { IInvitationRepository } from '../../domain/interfaces';
import type { Invitation } from '../../domain/entities';
import { INVITATION_TTL_HOURS } from '../../domain/entities';

/**
 * Maps a raw Supabase row (snake_case) to the Invitation domain entity (camelCase).
 */
function toEntity(row: Record<string, unknown>): Invitation {
  return {
    id: row.id as string,
    consentId: row.consent_id as string,
    inviteLink: row.invite_link as string,
    createdAt: new Date(row.created_at as string),
    expiresAt: new Date(row.expires_at as string),
    isUsed: row.is_used as boolean,
  };
}

/**
 * Supabase implementation of IInvitationRepository.
 */
export class InvitationRepository implements IInvitationRepository {
  /**
   * Creates a new invitation for the given consent.
   * Uses the consent's secure_code as the invite_link and sets a TTL of INVITATION_TTL_HOURS.
   */
  async create(consentId: string): Promise<Invitation> {
    // Fetch the secure_code from the parent consent
    const { data: consent, error: consentError } = await supabase
      .from('consents')
      .select('secure_code')
      .eq('id', consentId)
      .maybeSingle();

    if (consentError) throw consentError;
    if (!consent) throw new Error('CONSENT_NOT_FOUND');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITATION_TTL_HOURS);

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        consent_id: consentId,
        invite_link: consent.secure_code as string,
        expires_at: expiresAt.toISOString(),
        is_used: false,
      })
      .select()
      .single();

    if (error) throw error;
    return toEntity(data as Record<string, unknown>);
  }

  /**
   * Finds a single invitation by its invite_link value.
   */
  async findByLink(link: string): Promise<Invitation | null> {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('invite_link', link)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toEntity(data as Record<string, unknown>);
  }

  /**
   * Finds the most recent invitation for a given consent.
   */
  async findByConsentId(consentId: string): Promise<Invitation | null> {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('consent_id', consentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toEntity(data as Record<string, unknown>);
  }

  /**
   * Marks an invitation as used (is_used = true).
   */
  async markAsUsed(id: string): Promise<void> {
    const { error } = await supabase
      .from('invitations')
      .update({ is_used: true })
      .eq('id', id);

    if (error) throw error;
  }
}

export const invitationRepository = new InvitationRepository();

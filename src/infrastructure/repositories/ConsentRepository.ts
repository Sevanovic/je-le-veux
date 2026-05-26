import { supabase } from '../api/supabase';
import type { IConsentRepository } from '../../domain/interfaces';
import type { Consent, CreateConsentDTO } from '../../domain/entities';
import type { ConsentStatus, ConsentLevel } from '../../domain/enums';

/**
 * Maps a raw Supabase DB row (snake_case) to the Consent domain entity (camelCase).
 */
function toEntity(row: Record<string, unknown>): Consent {
  return {
    id: row.id as string,
    secureCode: row.secure_code as string,
    initiatorId: row.initiator_id as string,
    initiatorPseudonym: row.initiator_pseudonym as string,
    receiverId: row.receiver_id != null ? (row.receiver_id as string) : undefined,
    receiverPseudonym: row.receiver_pseudonym != null ? (row.receiver_pseudonym as string) : undefined,
    encryptedStatement: row.encrypted_statement as string,
    level: row.level as ConsentLevel,
    status: row.status as ConsentStatus,
    durationMinutes: row.duration_minutes as number,
    encryptedConditions: row.encrypted_conditions != null ? (row.encrypted_conditions as string) : undefined,
    createdAt: new Date(row.created_at as string),
    acceptedAt: row.accepted_at != null ? new Date(row.accepted_at as string) : undefined,
    expiresAt: row.expires_at != null ? new Date(row.expires_at as string) : undefined,
    withdrawnAt: row.withdrawn_at != null ? new Date(row.withdrawn_at as string) : undefined,
    withdrawnBy: row.withdrawn_by != null ? (row.withdrawn_by as string) : undefined,
    refusedAt: row.refused_at != null ? new Date(row.refused_at as string) : undefined,
  };
}

/**
 * Supabase implementation of IConsentRepository.
 *
 * All consent lifecycle operations (create, query, status updates, delete)
 * are delegated to the `consents` table in Supabase with RLS enforced.
 */
export class ConsentRepository implements IConsentRepository {
  async create(dto: CreateConsentDTO): Promise<Consent> {
    const { data, error } = await supabase
      .from('consents')
      .insert({
        initiator_id: dto.initiatorId,
        initiator_pseudonym: dto.initiatorPseudonym,
        secure_code: dto.secureCode,
        encrypted_statement: dto.statement,
        level: dto.level,
        duration_minutes: dto.durationMinutes,
        encrypted_conditions: dto.conditions ?? null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return toEntity(data as Record<string, unknown>);
  }

  async findById(id: string): Promise<Consent | null> {
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toEntity(data as Record<string, unknown>);
  }

  async findBySecureCode(code: string): Promise<Consent | null> {
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('secure_code', code)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return toEntity(data as Record<string, unknown>);
  }

  async findByUserId(userId: string): Promise<Consent[]> {
    // Fetch consents where user is initiator OR receiver
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .or(`initiator_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => toEntity(row as Record<string, unknown>));
  }

  async findByStatus(userId: string, status: ConsentStatus): Promise<Consent[]> {
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('initiator_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map((row) => toEntity(row as Record<string, unknown>));
  }

  async updateStatus(
    id: string,
    status: ConsentStatus,
    metadata?: Record<string, unknown>,
  ): Promise<Consent> {
    const updates: Record<string, unknown> = { status };

    if (metadata) {
      // Convert camelCase metadata keys to snake_case DB columns
      const keyMap: Record<string, string> = {
        acceptedAt: 'accepted_at',
        expiresAt: 'expires_at',
        withdrawnAt: 'withdrawn_at',
        withdrawnBy: 'withdrawn_by',
        refusedAt: 'refused_at',
        receiverId: 'receiver_id',
        receiverPseudonym: 'receiver_pseudonym',
      };

      for (const [camelKey, value] of Object.entries(metadata)) {
        const snakeKey = keyMap[camelKey] ?? camelKey;
        updates[snakeKey] = value;
      }
    }

    const { data, error } = await supabase
      .from('consents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return toEntity(data as Record<string, unknown>);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('consents')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  subscribeToUserConsents(
    userId: string,
    onChange: (consent: Consent) => void,
  ): { unsubscribe: () => void } {
    const channel = supabase
      .channel(`consents:user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consents',
          filter: `initiator_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            onChange(toEntity(payload.new as Record<string, unknown>));
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consents',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            onChange(toEntity(payload.new as Record<string, unknown>));
          }
        },
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }
}

export const consentRepository = new ConsentRepository();

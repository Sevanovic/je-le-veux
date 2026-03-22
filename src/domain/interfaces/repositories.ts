import { Consent, CreateConsentDTO } from '../entities/Consent';
import { User, CreateUserDTO } from '../entities/User';
import { Invitation } from '../entities/Invitation';
import { ConsentStatus } from '../enums';

/**
 * Contrat du repository de consentements.
 * L'infrastructure (Supabase) implémente cette interface.
 * Le domain ne connaît jamais l'implémentation.
 */
export interface IConsentRepository {
  create(dto: CreateConsentDTO): Promise<Consent>;
  findById(id: string): Promise<Consent | null>;
  findBySecureCode(code: string): Promise<Consent | null>;
  findByUserId(userId: string): Promise<Consent[]>;
  findByStatus(userId: string, status: ConsentStatus): Promise<Consent[]>;
  updateStatus(id: string, status: ConsentStatus, metadata?: Record<string, unknown>): Promise<Consent>;
  delete(id: string): Promise<void>;
}

/**
 * Contrat du repository utilisateurs.
 */
export interface IUserRepository {
  create(dto: CreateUserDTO): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByPseudonym(pseudonym: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
}

/**
 * Contrat du repository invitations.
 */
export interface IInvitationRepository {
  create(consentId: string): Promise<Invitation>;
  findByLink(link: string): Promise<Invitation | null>;
  findByConsentId(consentId: string): Promise<Invitation | null>;
  markAsUsed(id: string): Promise<void>;
}

/**
 * Contrat du service de chiffrement.
 */
export interface ICryptoService {
  generateKeyPair(): Promise<{ publicKey: string; secretKey: string }>;
  encrypt(message: string, recipientPublicKey: string, senderSecretKey: string): Promise<string>;
  decrypt(encryptedMessage: string, senderPublicKey: string, recipientSecretKey: string): Promise<string>;
}

/**
 * Contrat du service de notifications.
 */
export interface INotificationService {
  sendInvitation(userId: string, initiatorPseudonym: string): Promise<void>;
  sendAccepted(userId: string, receiverPseudonym: string): Promise<void>;
  sendWithdrawn(userId: string): Promise<void>;
  sendExpiringSoon(userId: string, minutesLeft: number): Promise<void>;
}

/**
 * Contrat du service de stockage local sécurisé.
 */
export interface ISecureStorageService {
  save(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

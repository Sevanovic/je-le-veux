import { Consent, CreateConsentDTO } from '../entities/Consent';
import { User, CreateUserDTO } from '../entities/User';
import { Invitation } from '../entities/Invitation';
import { ConsentStatus, SupportedLanguage } from '../enums';

/**
 * Contract for the consent repository.
 * Infrastructure (Supabase) implements this interface.
 * The domain layer never knows the concrete implementation.
 */
export interface IConsentRepository {
  create(dto: CreateConsentDTO): Promise<Consent>;
  findById(id: string): Promise<Consent | null>;
  findBySecureCode(code: string): Promise<Consent | null>;
  findByUserId(userId: string): Promise<Consent[]>;
  findByStatus(userId: string, status: ConsentStatus): Promise<Consent[]>;
  updateStatus(id: string, status: ConsentStatus, metadata?: Record<string, unknown>): Promise<Consent>;
  delete(id: string): Promise<void>;

  /**
   * Subscribe to changes on consents where the user is initiator OR receiver.
   * Returns an unsubscribe function. Used by App.tsx for realtime updates.
   */
  subscribeToUserConsents(
    userId: string,
    onChange: (consent: Consent) => void,
  ): { unsubscribe: () => void };
}

/**
 * Contract for the user repository.
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
 * Contract for the invitation repository.
 */
export interface IInvitationRepository {
  create(consentId: string): Promise<Invitation>;
  findByLink(link: string): Promise<Invitation | null>;
  findByConsentId(consentId: string): Promise<Invitation | null>;
  markAsUsed(id: string): Promise<void>;
}

/**
 * Contract for the authentication service.
 * Handles sign up, sign in, session management, and profile CRUD.
 */
export interface IAuthService {
  signUp(params: {
    email: string;
    password: string;
    pseudonym: string;
    preferredLanguage: SupportedLanguage;
  }): Promise<{ userId: string }>;

  signIn(params: {
    email: string;
    password: string;
  }): Promise<{ userId: string }>;

  sendMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  getSession(): Promise<{ userId: string } | null>;
  getProfile(userId: string): Promise<User | null>;
  updateProfile(userId: string, updates: Partial<User>): Promise<void>;
  /**
   * Delete the current authenticated user account via supabase.rpc('delete_my_account').
   * Cascades: profile, consents, invitations are removed via FK ON DELETE CASCADE.
   * The caller must clear local storage and sign out separately.
   */
  deleteCurrentAccount(): Promise<void>;
  onAuthStateChange(callback: (event: string, userId: string | null) => void): { unsubscribe: () => void };
}

/**
 * Contract for the E2E encryption service.
 */
export interface ICryptoService {
  generateKeyPair(): Promise<{ publicKey: string; secretKey: string }>;
  encrypt(message: string, recipientPublicKey: string, senderSecretKey: string): Promise<string>;
  decrypt(encryptedMessage: string, senderPublicKey: string, recipientSecretKey: string): Promise<string>;

  /** Generate a random 32-byte symmetric key, base64 encoded. */
  generateSymmetricKey(): Promise<string>;
  /** Encrypt with TweetNaCl secretbox. Nonce prepended to ciphertext, all base64. */
  encryptSymmetric(message: string, key: string): Promise<string>;
  /** Decrypt a secretbox ciphertext with the given key. */
  decryptSymmetric(ciphertext: string, key: string): Promise<string>;
}

/**
 * Contract for the push notification service.
 */
export interface INotificationService {
  sendInvitation(userId: string, initiatorPseudonym: string): Promise<void>;
  sendAccepted(userId: string, receiverPseudonym: string): Promise<void>;
  sendWithdrawn(userId: string): Promise<void>;
  sendExpiringSoon(userId: string, minutesLeft: number): Promise<void>;
}

/**
 * Contract for secure local storage (Keychain / Keystore).
 */
export interface ISecureStorageService {
  save(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  /**
   * Wipe every jeleveux.* key stored on this device.
   * Used during account deletion (GDPR right to erasure).
   * Best-effort: individual key failures are swallowed.
   */
  clearAll(): Promise<void>;
}

/**
 * Contract for biometric authentication (Face ID, Touch ID, fingerprint).
 */
export interface IBiometricService {
  /** True if the device has biometric hardware. */
  isAvailable(): Promise<boolean>;
  /** True if the user has enrolled at least one credential. */
  isEnrolled(): Promise<boolean>;
  /** Prompt the user. Returns true on success, false on user cancel / failure. */
  authenticate(reason?: string): Promise<boolean>;
}

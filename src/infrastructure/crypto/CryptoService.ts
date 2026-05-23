import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import type { ICryptoService } from '../../domain/interfaces';

/**
 * Service de chiffrement E2E basé sur TweetNaCl (NaCl Box).
 *
 * Utilise un chiffrement asymétrique Curve25519-XSalsa20-Poly1305 :
 * - Chaque utilisateur a une paire de clés (publique + secrète)
 * - L'énoncé est chiffré avec la clé publique du destinataire
 * - Seul le destinataire peut déchiffrer avec sa clé secrète
 *
 * Les clés et messages sont encodés en Base64 pour le stockage.
 */
export class CryptoService implements ICryptoService {
  /**
   * Génère une nouvelle paire de clés Curve25519.
   */
  async generateKeyPair(): Promise<{
    publicKey: string;
    secretKey: string;
  }> {
    const keyPair = nacl.box.keyPair();
    return {
      publicKey: naclUtil.encodeBase64(keyPair.publicKey),
      secretKey: naclUtil.encodeBase64(keyPair.secretKey),
    };
  }

  /**
   * Chiffre un message pour un destinataire spécifique.
   * Le nonce est généré aléatoirement et préfixé au message chiffré.
   */
  async encrypt(
    message: string,
    recipientPublicKey: string,
    senderSecretKey: string,
  ): Promise<string> {
    const messageUint8 = naclUtil.decodeUTF8(message);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const recipientKey = naclUtil.decodeBase64(recipientPublicKey);
    const senderKey = naclUtil.decodeBase64(senderSecretKey);

    const encrypted = nacl.box(messageUint8, nonce, recipientKey, senderKey);

    if (!encrypted) {
      throw new Error('Encryption failed');
    }

    // Préfixer le nonce au message chiffré pour le déchiffrement
    const fullMessage = new Uint8Array(nonce.length + encrypted.length);
    fullMessage.set(nonce);
    fullMessage.set(encrypted, nonce.length);

    return naclUtil.encodeBase64(fullMessage);
  }

  /**
   * Déchiffre un message reçu.
   * Extrait le nonce préfixé puis déchiffre.
   */
  async decrypt(
    encryptedMessage: string,
    senderPublicKey: string,
    recipientSecretKey: string,
  ): Promise<string> {
    const fullMessage = naclUtil.decodeBase64(encryptedMessage);
    const nonce = fullMessage.slice(0, nacl.box.nonceLength);
    const message = fullMessage.slice(nacl.box.nonceLength);
    const senderKey = naclUtil.decodeBase64(senderPublicKey);
    const recipientKey = naclUtil.decodeBase64(recipientSecretKey);

    const decrypted = nacl.box.open(message, nonce, senderKey, recipientKey);

    if (!decrypted) {
      throw new Error('Decryption failed — invalid key or corrupted message');
    }

    return naclUtil.encodeUTF8(decrypted);
  }

  /**
   * Generate a random 32-byte symmetric key.
   * Encoded in base64 for transport in QR codes / shareCode.
   */
  async generateSymmetricKey(): Promise<string> {
    const key = nacl.randomBytes(nacl.secretbox.keyLength);
    return naclUtil.encodeBase64(key);
  }

  /**
   * Encrypt a message with a symmetric key using TweetNaCl secretbox
   * (XSalsa20-Poly1305). Nonce is prepended to ciphertext, all base64.
   */
  async encryptSymmetric(message: string, key: string): Promise<string> {
    const messageUint8 = naclUtil.decodeUTF8(message);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const keyUint8 = naclUtil.decodeBase64(key);

    const encrypted = nacl.secretbox(messageUint8, nonce, keyUint8);
    if (!encrypted) {
      throw new Error('Symmetric encryption failed');
    }

    const fullMessage = new Uint8Array(nonce.length + encrypted.length);
    fullMessage.set(nonce);
    fullMessage.set(encrypted, nonce.length);

    return naclUtil.encodeBase64(fullMessage);
  }

  /**
   * Decrypt a secretbox ciphertext with the given symmetric key.
   * Throws if the key is wrong or the ciphertext is corrupted.
   */
  async decryptSymmetric(ciphertext: string, key: string): Promise<string> {
    const fullMessage = naclUtil.decodeBase64(ciphertext);
    const nonce = fullMessage.slice(0, nacl.secretbox.nonceLength);
    const message = fullMessage.slice(nacl.secretbox.nonceLength);
    const keyUint8 = naclUtil.decodeBase64(key);

    const decrypted = nacl.secretbox.open(message, nonce, keyUint8);
    if (!decrypted) {
      throw new Error('Symmetric decryption failed — invalid key or corrupted ciphertext');
    }

    return naclUtil.encodeUTF8(decrypted);
  }
}

// Singleton
export const cryptoService = new CryptoService();

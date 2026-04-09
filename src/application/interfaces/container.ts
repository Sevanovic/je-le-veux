import type {
  IAuthService,
  ICryptoService,
  ISecureStorageService,
  IConsentRepository,
  IInvitationRepository,
} from '../../domain/interfaces';

/**
 * Dependency injection container for the Application layer.
 *
 * All use cases receive their dependencies through this container
 * rather than importing infrastructure directly. This ensures:
 * - Domain/Application layers never depend on Infrastructure
 * - Easy to swap implementations (e.g., mock for testing)
 * - Single source of truth for service wiring
 *
 * Initialized once at app startup via `initContainer()`.
 */
interface ServiceContainer {
  auth: IAuthService;
  crypto: ICryptoService;
  secureStorage: ISecureStorageService;
  consent: IConsentRepository;
  invitation: IInvitationRepository;
}

let container: ServiceContainer | null = null;

/**
 * Initialize the DI container with concrete implementations.
 * Must be called once at app startup before any use case is invoked.
 */
export function initContainer(services: ServiceContainer): void {
  container = services;
}

/**
 * Retrieve the DI container.
 * Throws if called before initialization.
 */
export function getContainer(): ServiceContainer {
  if (!container) {
    throw new Error(
      'Service container not initialized. Call initContainer() in App.tsx before rendering.',
    );
  }
  return container;
}

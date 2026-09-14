import type {
  FullUser,
  PasswordResetSession,
  Session,
  User,
} from "../../domain/auth/types";

/**
 * REGISTRIES FOR MODULAR EXTENSIONS
 */

type IdentityAugmenter = (user: User) => Promise<Partial<FullUser>>;
type SessionAugmenter = (session: Session) => Promise<Partial<Session>>;
type PasswordResetSessionAugmenter = (
  session: PasswordResetSession,
) => Promise<Partial<PasswordResetSession>>;

const globalForAugment = globalThis as unknown as {
  __VEAP_IDENTITY_AUGMENTERS__: Set<IdentityAugmenter> | undefined;
  __VEAP_SESSION_AUGMENTERS__: Set<SessionAugmenter> | undefined;
  __VEAP_PASSWORD_RESET_SESSION_AUGMENTERS__:
    Set<PasswordResetSessionAugmenter> | undefined;
};

const identityAugmenters =
  globalForAugment.__VEAP_IDENTITY_AUGMENTERS__ ?? new Set<IdentityAugmenter>();
const sessionAugmenters =
  globalForAugment.__VEAP_SESSION_AUGMENTERS__ ?? new Set<SessionAugmenter>();
const passwordResetSessionAugmenters =
  globalForAugment.__VEAP_PASSWORD_RESET_SESSION_AUGMENTERS__ ??
  new Set<PasswordResetSessionAugmenter>();

globalForAugment.__VEAP_IDENTITY_AUGMENTERS__ = identityAugmenters;
globalForAugment.__VEAP_SESSION_AUGMENTERS__ = sessionAugmenters;
globalForAugment.__VEAP_PASSWORD_RESET_SESSION_AUGMENTERS__ =
  passwordResetSessionAugmenters;

export function registerIdentityAugmenter(augmenter: IdentityAugmenter) {
  identityAugmenters.add(augmenter);
}

export function registerSessionAugmenter(augmenter: SessionAugmenter) {
  sessionAugmenters.add(augmenter);
}

export function registerPasswordResetSessionAugmenter(
  augmenter: PasswordResetSessionAugmenter,
) {
  passwordResetSessionAugmenters.add(augmenter);
}

/**
 * EXECUTION FUNCTIONS
 */
export async function augmentUser(
  user: User,
  coreRbacData?: Record<string, any>,
): Promise<FullUser> {
  let augmentedData = coreRbacData || {};
  for (const augmenter of identityAugmenters) {
    const data = await augmenter(user);
    augmentedData = { ...augmentedData, ...data };
  }
  return { ...user, ...augmentedData } as FullUser;
}

export async function augmentSession(session: Session): Promise<Session> {
  let augmentedData = {};
  for (const augmenter of sessionAugmenters) {
    const data = await augmenter(session);
    augmentedData = { ...augmentedData, ...data };
  }
  return { ...session, ...augmentedData } as Session;
}

export async function augmentPasswordResetSession(
  session: PasswordResetSession,
): Promise<PasswordResetSession> {
  let augmentedData = {};
  for (const augmenter of passwordResetSessionAugmenters) {
    const data = await augmenter(session);
    augmentedData = { ...augmentedData, ...data };
  }
  return { ...session, ...augmentedData } as PasswordResetSession;
}

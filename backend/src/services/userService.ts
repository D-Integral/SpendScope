import { prisma } from '../prisma.js';

export interface ProviderProfile {
  provider: 'google' | 'github';
  providerUserId: string;
  email?: string | null;
  displayName: string;
  avatarUrl?: string | null;
}

/**
 * Find-or-create a local user record for an SSO profile.
 *
 * Identity is keyed on (provider + providerUserId) because some providers
 * (notably GitHub) may not return an email. On first sign-in a user record is
 * created automatically; on subsequent sign-ins mutable profile fields are
 * refreshed.
 */
export async function upsertUserFromProfile(profile: ProviderProfile) {
  return prisma.user.upsert({
    where: {
      provider_providerUserId: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
    },
    update: {
      email: profile.email ?? undefined,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl ?? undefined,
    },
    create: {
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      email: profile.email ?? null,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl ?? null,
    },
  });
}

export function publicUser(user: {
  id: string;
  provider: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    provider: user.provider,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

export const ideURI = window.location.origin;

export const bitauthWalletTemplateSchema =
  'https://libauth.org/schemas/wallet-template-v0.schema.json';

export const localStorageBackupPrefix = 'BITAUTH_IDE_BACKUP_';

export const localStorageCorruptedBackupPrefix =
  'BITAUTH_IDE_CORRUPTED_BACKUP_';

export const backupWarningLimit = 500;

export const localStorageTrackingConsent = 'BITAUTH_IDE_TRACKING_CONSENT';

export const localStorageDisableNotifier =
  'BITAUTH_IDE_E2E_TESTING_DISABLE_NOTIFIER';

export const notifierEnabled = () =>
  localStorage.getItem(localStorageDisableNotifier) !== 'true';

export const analyticsBuilt =
  import.meta.env.VITE_PUBLIC_ANALYTICS_ENABLE === '1';

export const analyticsEnabled = () =>
  analyticsBuilt ||
  localStorage.getItem('BITAUTH_IDE_E2E_TESTING_ANALYTICS_ENABLE') === 'true';

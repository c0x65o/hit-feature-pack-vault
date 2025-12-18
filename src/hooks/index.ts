/**
 * Vault Hooks
 * Exported individually for tree-shaking
 */

export {
  useOtpSubscription,
  getWebSocketStatus,
  isWebSocketAvailable,
  getGlobalWsStatus,
  subscribeGlobalWsStatus,
  getGlobalOtpConnectionType,
  subscribeGlobalOtpConnectionType,
} from './useOtpSubscription';

export type {
  OtpNotification,
  UseOtpSubscriptionOptions,
  UseOtpSubscriptionResult,
} from './useOtpSubscription';

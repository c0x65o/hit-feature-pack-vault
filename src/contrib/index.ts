/**
 * Vault pack contributions (dynamically loaded by the platform).
 *
 * The platform uses this module to resolve “special” behavior declared in schema
 * (e.g. meta.headerActions with actionKey).
 */
'use client';

import { actionHandlers } from './entityActions';

export type PackActionHandlerContext = {
  entityKey: string;
  record: any;
  uiSpec?: any;
  navigate?: (path: string) => void;
};

export type PackContrib = {
  actionHandlers?: Record<string, (ctx: PackActionHandlerContext) => void | Promise<void>>;
};

export const contrib: PackContrib = {
  actionHandlers,
};

export default contrib;


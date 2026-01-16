/**
 * Vault pack contributions (dynamically loaded by the platform).
 *
 * The platform uses this module to resolve “special” behavior declared in schema
 * (e.g. meta.headerActions with actionKey).
 */
'use client';
import { actionHandlers } from './entityActions';
export const contrib = {
    actionHandlers,
};
export default contrib;

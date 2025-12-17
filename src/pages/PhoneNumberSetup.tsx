'use client';

import React, { useState, useEffect } from 'react';
import { useUi, type BreadcrumbItem } from '@hit/ui-kit';
import { Save, Trash2, AlertCircle, Lock as LockIcon, Phone, Settings } from 'lucide-react';
import { vaultApi } from '../services/vault-api';

interface Props {
  onNavigate?: (path: string) => void;
}

export function PhoneNumberSetup({ onNavigate }: Props) {
  const { Page, Card, Button, Input, Alert } = useUi();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentPhoneNumber, setCurrentPhoneNumber] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  useEffect(() => {
    loadCurrentPhoneNumber();
    checkAdminStatus();
  }, []);

  async function checkAdminStatus() {
    // TODO: Check if user has admin role
    // For now, assume admin (this should be checked via API)
    setIsAdmin(true);
  }

  async function loadCurrentPhoneNumber() {
    try {
      setLoading(true);
      const result = await vaultApi.getGlobalPhoneNumber();
      // Filter out email placeholder - it's not a real phone number
      const phoneNumber = result.phoneNumber === '[email-inbox]' ? null : result.phoneNumber;
      setCurrentPhoneNumber(phoneNumber);
      setPhoneNumber(phoneNumber || '');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load phone number'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!phoneNumber.trim()) {
      setError(new Error('Phone number is required'));
      return;
    }

    // Basic phone number validation (E.164 format)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber.trim())) {
      setError(new Error('Phone number must be in E.164 format (e.g., +1234567890)'));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await vaultApi.setGlobalPhoneNumber(phoneNumber.trim());
      setCurrentPhoneNumber(phoneNumber.trim());
      // Show success message
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save phone number'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete the phone number? This will disable SMS 2FA for all vault items.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await vaultApi.deleteGlobalPhoneNumber();
      setCurrentPhoneNumber(null);
      setPhoneNumber('');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete phone number'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Page title="Loading..." description="">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </Page>
    );
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Vault', href: '/vault/personal', icon: <LockIcon size={14} /> },
    { label: 'Setup', href: '/vault/setup', icon: <Settings size={14} /> },
    { label: 'Phone Number', icon: <Phone size={14} /> },
  ];

  if (!isAdmin) {
    return (
      <Page title="Phone Number Setup" description="Configure SMS phone number for 2FA" breadcrumbs={breadcrumbs} onNavigate={navigate}>
        <Alert variant="error" title="Access Denied">
          Admin access required to configure phone numbers.
        </Alert>
      </Page>
    );
  }

  return (
    <Page
      title="Phone Number Setup"
      description="Configure the shared phone number for SMS 2FA codes"
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
    >
      {error && (
        <Alert variant="error" title="Error">
          {error.message}
        </Alert>
      )}

      <Card>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Phone Number</label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Enter the phone number in E.164 format (e.g., +1234567890).
              This number will be used for receiving 2FA codes for all vault items.
              Supports F-Droid (Android phone) or Twilio integrations.
            </p>
            <Input
              value={phoneNumber}
              onChange={(value: string) => setPhoneNumber(value)}
              placeholder="+1234567890"
            />
          </div>

          {currentPhoneNumber && (
            <Alert variant="info" title="Current Configuration">
              <p className="text-sm mt-2">
                Current phone number: <code className="font-mono">{currentPhoneNumber}</code>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Configure F-Droid or Twilio to send webhooks to:{' '}
                <code className="font-mono text-xs">
                  {typeof window !== 'undefined' 
                    ? `${window.location.origin}/api/vault/sms/webhook/inbound`
                    : '/api/vault/sms/webhook/inbound'}
                </code>
                <br />
                <span className="mt-1 block">
                  For F-Droid: Set Authorization header to <code className="font-mono">Bearer {'<API_KEY>'}</code> or use X-API-Key header.
                </span>
              </p>
            </Alert>
          )}

          {!currentPhoneNumber && (
            <Alert variant="warning" title="No Phone Number Configured">
              <p className="text-sm mt-2">
                No phone number is currently configured. Users will not be able to use SMS 2FA until a phone number is set up.
              </p>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            {currentPhoneNumber && (
              <Button
                variant="secondary"
                onClick={handleDelete}
                disabled={saving}
              >
                <Trash2 size={16} className="mr-2" />
                Delete
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || !phoneNumber.trim()}
            >
              <Save size={16} className="mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Card>
    </Page>
  );
}

export default PhoneNumberSetup;


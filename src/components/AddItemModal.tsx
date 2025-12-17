'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save, Copy, Check, Eye, EyeOff, Mail, Phone, MessageSquare, Wifi, WifiOff } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { useOtpSubscription, isWebSocketAvailable } from '../hooks/useOtpSubscription';
import { extractOtpWithConfidence } from '../utils/otp-extractor';

type ItemType = 'credential' | 'api_key' | 'secure_note';
type TwoFactorType = 'off' | 'qr' | 'phone' | 'email';

interface Props {
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  folderId?: string | null;
}

export function AddItemModal({ onClose, onSave, folderId }: Props) {
  const { Modal, Button, Input, Select, Alert } = useUi();
  const [open, setOpen] = useState(true);
  const [itemType, setItemType] = useState<ItemType>('credential');
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [url, setUrl] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [secret, setSecret] = useState(''); // For SSH keys, API keys
  const [notes, setNotes] = useState('');
  const [twoFactorType, setTwoFactorType] = useState<TwoFactorType>('off');
  const [globalPhoneNumber, setGlobalPhoneNumber] = useState<string | null>(null);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [pollingSms, setPollingSms] = useState(false);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpConfidence, setOtpConfidence] = useState<'high' | 'medium' | 'low' | 'none'>('none');
  const [otpFullMessage, setOtpFullMessage] = useState<string | null>(null);
  const [showFullMessage, setShowFullMessage] = useState(false);
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Email 2FA state
  const [globalEmailAddress, setGlobalEmailAddress] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const [pollingEmail, setPollingEmail] = useState(false);

  useEffect(() => {
    if (twoFactorType === 'phone') {
      loadGlobalPhoneNumber();
    } else if (twoFactorType === 'email') {
      loadGlobalEmailAddress();
    }
  }, [twoFactorType]);

  async function loadGlobalPhoneNumber() {
    try {
      const result = await vaultApi.getGlobalPhoneNumber();
      setGlobalPhoneNumber(result.phoneNumber);
    } catch (err) {
      console.error('Failed to load global phone number:', err);
    }
  }

  async function copyPhoneNumber() {
    if (!globalPhoneNumber) return;
    try {
      await navigator.clipboard.writeText(globalPhoneNumber);
      setPhoneCopied(true);
      setTimeout(() => setPhoneCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy phone number:', err);
    }
  }

  async function loadGlobalEmailAddress() {
    try {
      const result = await vaultApi.getGlobalEmailAddress();
      setGlobalEmailAddress(result.emailAddress);
    } catch (err) {
      console.error('Failed to load global email address:', err);
    }
  }

  async function copyEmailAddress() {
    if (!globalEmailAddress) return;
    try {
      await navigator.clipboard.writeText(globalEmailAddress);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy email address:', err);
    }
  }

  async function startSmsPolling() {
    if (pollingSms) return;
    setPollingSms(true);
    setOtpCode(null);
    setOtpConfidence('none');
    setOtpFullMessage(null);
    setShowFullMessage(false);

    const interval = setInterval(async () => {
      try {
        const result = await vaultApi.getLatestSmsMessages();
        for (const msg of result.messages) {
          try {
            const revealResult = await vaultApi.revealSmsMessage(msg.id);
            const otpResult = extractOtpWithConfidence(revealResult.body);
            if (otpResult.code) {
              setOtpCode(otpResult.code);
              setOtpConfidence(otpResult.confidence);
              setOtpFullMessage(otpResult.fullMessage);
              setPollingSms(false);
              clearInterval(interval);
              return;
            }
          } catch (err) {
            console.error('Failed to reveal SMS message:', err);
          }
        }
      } catch (err) {
        console.error('Failed to poll SMS messages:', err);
      }
    }, 2000);

    setTimeout(() => {
      clearInterval(interval);
      setPollingSms(false);
    }, 5 * 60 * 1000);
  }

  async function startEmailPolling() {
    if (pollingEmail) return;
    setPollingEmail(true);
    setOtpCode(null);
    setOtpConfidence('none');
    setOtpFullMessage(null);
    setShowFullMessage(false);

    const interval = setInterval(async () => {
      try {
        const result = await vaultApi.getLatestEmailMessages();
        for (const msg of result.messages) {
          try {
            const revealResult = await vaultApi.revealSmsMessage(msg.id);
            const otpResult = extractOtpWithConfidence(revealResult.body);
            if (otpResult.code) {
              setOtpCode(otpResult.code);
              setOtpConfidence(otpResult.confidence);
              setOtpFullMessage(otpResult.fullMessage);
              setPollingEmail(false);
              clearInterval(interval);
              return;
            }
          } catch (err) {
            console.error('Failed to reveal email message:', err);
          }
        }
      } catch (err) {
        console.error('Failed to poll email messages:', err);
      }
    }, 2000);

    setTimeout(() => {
      clearInterval(interval);
      setPollingEmail(false);
    }, 5 * 60 * 1000);
  }

  function formatTimeAgo(date: Date | null): string {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffHours / 24)} day${Math.floor(diffHours / 24) > 1 ? 's' : ''} ago`;
  }

  async function handleSave() {
    if (!title.trim()) {
      setError(new Error('Title is required'));
      return;
    }
    if (itemType === 'credential' && !url.trim()) {
      setError(new Error('URL is required for Login items'));
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const itemData: any = {
        title: title.trim(),
        type: itemType,
        folderId: folderId || null,
      };

      // Type-specific fields
      if (itemType === 'credential') {
        itemData.username = username.trim() || null;
        itemData.url = url.trim() || null;
        itemData.password = password;
      } else if (itemType === 'api_key') {
        // For API keys, store secret in password field (backend handles encryption)
        itemData.password = secret.trim();
      }

      itemData.notes = notes.trim() || null;

      // 2FA data - store TOTP secret separately to import after item creation
      if (twoFactorType === 'qr' && qrCodeInput.trim()) {
        itemData.totpSecret = qrCodeInput.trim();
      }
      // Phone 2FA doesn't need to store anything - it uses the global phone number

      await onSave(itemData);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save item'));
    } finally {
      setSaving(false);
    }
  }

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Add Item"
      onClose={handleClose}
      size="lg"
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="error" title="Error">
            {error.message}
          </Alert>
        )}

        <div>
          <label className="text-sm font-medium">Type</label>
          <Select
            value={itemType}
            onChange={(value) => setItemType(value as ItemType)}
            options={[
              { value: 'credential', label: 'Login' },
              { value: 'api_key', label: 'SSH Key / API Key' },
              { value: 'secure_note', label: 'Secure Note' },
            ]}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Title *</label>
          <Input
            value={title}
            onChange={(value: string) => setTitle(value)}
            placeholder="e.g., GitHub Account"
          />
        </div>

        {itemType === 'credential' && (
          <>
            <div>
              <label className="text-sm font-medium">URL *</label>
              <Input
                value={url}
                onChange={(value: string) => setUrl(value)}
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Username</label>
              <Input
                value={username}
                onChange={(value: string) => setUsername(value)}
                placeholder="username or email"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <div className="flex items-center gap-2">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(value: string) => setPassword(value)}
                  placeholder="Enter password"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">2FA</label>
              <Select
                value={twoFactorType}
                onChange={(value) => setTwoFactorType(value as TwoFactorType)}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'qr', label: 'QR Code (TOTP)' },
                  { value: 'phone', label: 'Phone Number (SMS)' },
                  { value: 'email', label: 'Email' },
                ]}
              />
            </div>

            {twoFactorType === 'phone' && (
              <div className="mt-3 p-4 bg-secondary rounded-md space-y-3">
                {globalPhoneNumber ? (
                  <>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Phone size={14} />
                        Registered Phone Number
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                          {globalPhoneNumber}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyPhoneNumber}
                        >
                          {phoneCopied ? (
                            <Check size={16} className="text-green-600" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {!pollingSms && !otpCode && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={startSmsPolling}
                      >
                        <MessageSquare size={16} className="mr-2" />
                        Start Waiting for SMS
                      </Button>
                    )}
                    
                    {pollingSms && (
                      <p className="text-sm text-muted-foreground animate-pulse">
                        Waiting for SMS message...
                      </p>
                    )}
                    
                    {otpCode && (
                      <div className={`p-3 bg-background rounded-md border-2 ${
                        otpConfidence === 'high' 
                          ? 'border-green-500' 
                          : otpConfidence === 'medium' 
                            ? 'border-yellow-500' 
                            : 'border-gray-400'
                      }`}>
                        <label className={`text-sm font-medium ${
                          otpConfidence === 'high' 
                            ? 'text-green-600' 
                            : otpConfidence === 'medium' 
                              ? 'text-yellow-600' 
                              : 'text-gray-600'
                        }`}>
                          OTP Code Received ({otpConfidence} confidence)
                        </label>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-2xl font-mono font-bold">
                            {otpCode}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(otpCode)}
                          >
                            <Copy size={16} />
                          </Button>
                        </div>
                        
                        {otpConfidence !== 'high' && otpFullMessage && (
                          <div className="mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowFullMessage(!showFullMessage)}
                            >
                              {showFullMessage ? 'Hide Full Message' : 'Show Full Message'}
                            </Button>
                            {showFullMessage && (
                              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {otpFullMessage}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <Alert variant="warning" title="No Phone Number Configured">
                    Admin must configure a phone number in Setup.
                  </Alert>
                )}
              </div>
            )}

            {twoFactorType === 'email' && (
              <div className="mt-3 p-4 bg-secondary rounded-md space-y-3">
                {globalEmailAddress ? (
                  <>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Mail size={14} />
                        2FA Email Address
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                          {globalEmailAddress}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyEmailAddress}
                        >
                          {emailCopied ? (
                            <Check size={16} className="text-green-600" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        When the service sends a 2FA code to this email, it will be automatically detected.
                      </p>
                    </div>
                    
                    {!pollingEmail && !otpCode && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={startEmailPolling}
                      >
                        <Mail size={16} className="mr-2" />
                        Start Waiting for Email
                      </Button>
                    )}
                    
                    {pollingEmail && (
                      <p className="text-sm text-muted-foreground animate-pulse">
                        Waiting for email message...
                      </p>
                    )}
                    
                    {otpCode && (
                      <div className={`p-3 bg-background rounded-md border-2 ${
                        otpConfidence === 'high' 
                          ? 'border-green-500' 
                          : otpConfidence === 'medium' 
                            ? 'border-yellow-500' 
                            : 'border-gray-400'
                      }`}>
                        <label className={`text-sm font-medium ${
                          otpConfidence === 'high' 
                            ? 'text-green-600' 
                            : otpConfidence === 'medium' 
                              ? 'text-yellow-600' 
                              : 'text-gray-600'
                        }`}>
                          OTP Code Received ({otpConfidence} confidence)
                        </label>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-2xl font-mono font-bold">
                            {otpCode}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(otpCode)}
                          >
                            <Copy size={16} />
                          </Button>
                        </div>
                        
                        {otpConfidence !== 'high' && otpFullMessage && (
                          <div className="mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowFullMessage(!showFullMessage)}
                            >
                              {showFullMessage ? 'Hide Full Message' : 'Show Full Message'}
                            </Button>
                            {showFullMessage && (
                              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {otpFullMessage}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <Alert variant="warning" title="No Email Address Configured">
                    Admin must configure a 2FA email address in Setup.
                  </Alert>
                )}
              </div>
            )}

            {twoFactorType === 'qr' && (
              <div className="p-4 bg-secondary rounded-md space-y-3">
                <div>
                  <label className="text-sm font-medium">QR Code / TOTP Secret</label>
                  <p className="text-sm text-muted-foreground mt-1 mb-2">
                    Paste the TOTP secret URI (otpauth://totp/...) or base32 secret
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={qrCodeInput}
                      onChange={(value: string) => setQrCodeInput(value)}
                      placeholder="otpauth://totp/... or paste secret"
                      className="flex-1"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setQrCodeInput(text);
                        } catch (err) {
                          console.error('Failed to read clipboard:', err);
                        }
                      }}
                    >
                      Paste
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {itemType === 'api_key' && (
          <div>
            <label className="text-sm font-medium">Secret / Key</label>
            <div className="relative">
              <textarea
                value={showPassword ? secret : secret ? '•'.repeat(Math.max(secret.length, 50)) : ''}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Paste SSH key or API key"
                className="w-full px-3 py-2 border rounded-md min-h-[120px] font-mono text-sm"
                style={{
                  ...(showPassword ? {} : { 
                    caretColor: 'transparent',
                  })
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-2 right-2"
                title={showPassword ? 'Hide key' : 'Show key'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
          </div>
        )}

        {itemType === 'secure_note' && (
          <div>
            <label className="text-sm font-medium">Note Content</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter your secure note..."
              className="w-full px-3 py-2 border rounded-md min-h-[200px]"
            />
          </div>
        )}

        {itemType !== 'secure_note' && (
          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 border rounded-md min-h-[100px]"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || !title.trim() || (itemType === 'credential' && !url.trim())}
          >
            <Save size={16} className="mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}


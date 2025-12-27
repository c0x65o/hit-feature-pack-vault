'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUi, useAlertDialog, type BreadcrumbItem } from '@hit/ui-kit';
import { Eye, EyeOff, Copy, Edit, Check, RefreshCw, Key, FileText, Lock, Trash2 } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { VaultItem } from '../schema/vault';
import { isCurrentUserAdmin } from '../utils/user';

interface Props {
  itemId: string;
  onNavigate?: (path: string) => void;
}

export function ItemDetail({ itemId, onNavigate }: Props) {
  const { Page, Card, Button, Alert, AlertDialog } = useUi();
  const alertDialog = useAlertDialog();
  const isAdmin = useMemo(() => isCurrentUserAdmin(), []);
  const [item, setItem] = useState<VaultItem | null>(null);
  const [revealed, setRevealed] = useState<{ password?: string; secret?: string; notes?: string; totpSecret?: string; twoFactorType?: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState<string | null>(null);
  const [totpExpiresAt, setTotpExpiresAt] = useState<Date | null>(null);
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  useEffect(() => {
    if (itemId) {
      loadItem();
    }
  }, [itemId]);

  useEffect(() => {
    // Auto-reveal notes when item is loaded
    if (item && !revealed) {
      handleReveal().catch(err => {
        console.error('Failed to auto-reveal item:', err);
      });
    }
  }, [item, revealed]);

  useEffect(() => {
    // Auto-refresh TOTP code every 30 seconds
    if (revealed?.totpSecret) {
      generateTotpCode();
      const interval = setInterval(() => {
        generateTotpCode();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [revealed?.totpSecret]);

  async function loadItem() {
    try {
      setLoading(true);
      setRevealed(null); // Reset revealed state when loading new item
      const itemData = await vaultApi.getItem(itemId);
      setItem(itemData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load item'));
    } finally {
      setLoading(false);
    }
  }


  async function handleReveal() {
    if (!item) return;
    try {
      const revealedData = await vaultApi.revealItem(item.id);
      setRevealed(revealedData);
      // Don't auto-show - user must click eye icon to reveal
      setShowPassword(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to reveal item'));
    }
  }

  async function generateTotpCode() {
    if (!item || !revealed?.totpSecret) return;
    try {
      const result = await vaultApi.generateTotpCode(item.id);
      setTotpCode(result.code);
      setTotpExpiresAt(new Date(result.expiresAt));
    } catch (err) {
      console.error('Failed to generate TOTP code:', err);
    }
  }

  async function handleCopy(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied({ ...copied, [field]: true });
      setTimeout(() => {
        setCopied({ ...copied, [field]: false });
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to copy'));
    }
  }

  async function handleDelete() {
    if (!item) return;
    
    const confirmed = await alertDialog.showConfirm(
      `Are you sure you want to delete "${item.title}"? This action cannot be undone.`,
      {
        title: 'Delete Item',
        variant: 'error',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      }
    );

    if (!confirmed) {
      return;
    }

    try {
      await vaultApi.deleteItem(item.id);
      navigate('/vault');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete item'));
    }
  }

  function getItemIcon() {
    if (!item) return <Lock size={20} />;
    switch (item.type) {
      case 'api_key':
        return <Key size={20} />;
      case 'secure_note':
        return <FileText size={20} />;
      default:
        return <Lock size={20} />;
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
    { label: 'Vault', href: '/vault', icon: <Lock size={14} /> },
    ...(item?.folderId ? [{ label: 'Folder', href: '/vault' }] : []),
    { label: item?.title || 'Item' },
  ];

  return (
    <Page
      title={item?.title || 'Item not found'}
      description={item?.url || ''}
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
      actions={
        item ? (
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => navigate(`/vault/items/${item.id}/edit`)}>
              <Edit size={16} className="mr-2" />
              Edit
            </Button>
            {isAdmin && (
              <Button variant="danger" onClick={handleDelete}>
                <Trash2 size={16} className="mr-2" />
                Delete
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {error && (
        <Alert variant="error" title="Error">
          {error.message}
        </Alert>
      )}

      {!item && (
        <Card>
          <div className="p-6 text-center text-muted-foreground">
            Item not found
          </div>
        </Card>
      )}

      {item && (
        <div className="space-y-4">
          <Card>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                {getItemIcon()}
                <div className="flex-1">
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                </div>
              </div>

              {item.url && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">URL</label>
                  <div className="flex items-center gap-2 mt-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex-1"
                    >
                      {item.url}
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy('url', item.url!)}
                    >
                      {copied.url ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {item.username && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded flex-1">
                      {item.username}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy('username', item.username!)}
                    >
                      {copied.username ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {item.type === 'credential' && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Password</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded flex-1">
                      {revealed?.password && showPassword ? revealed.password : '••••••••'}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!revealed?.password) {
                          await handleReveal();
                          setShowPassword(true);
                        } else {
                          setShowPassword(!showPassword);
                        }
                      }}
                    >
                      {revealed?.password && showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                    {revealed?.password && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy('password', revealed.password!)}
                      >
                        {copied.password ? (
                          <Check size={16} className="text-green-600" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {item.type === 'api_key' && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Secret / Key</label>
                  <div className="relative mt-1">
                    {revealed?.secret || revealed?.password ? (
                      <>
                        <textarea
                          value={showPassword ? (revealed.secret || revealed.password) : '•'.repeat(Math.max((revealed.secret || revealed.password || '').length, 50))}
                          readOnly
                          className="w-full px-3 py-2 border rounded-md min-h-[200px] font-mono text-sm"
                          style={{
                            ...(showPassword ? {} : { 
                              caretColor: 'transparent',
                            })
                          }}
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? 'Hide key' : 'Show key'}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy('secret', revealed.secret || revealed.password!)}
                            title="Copy key"
                          >
                            {copied.secret ? (
                              <Check size={16} className="text-green-600" />
                            ) : (
                              <Copy size={16} />
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <textarea
                          value="••••••••"
                          readOnly
                          className="w-full px-3 py-2 border rounded-md min-h-[200px] font-mono text-sm"
                        />
                        <div className="absolute top-2 right-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReveal}
                            title="Reveal secret"
                          >
                            <Eye size={16} />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {revealed?.totpSecret && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">2FA Code (TOTP)</label>
                  <div className="flex items-center gap-2 mt-1">
                    {totpCode ? (
                      <>
                        <code className="text-2xl font-mono font-bold bg-secondary px-4 py-2 rounded">
                          {totpCode}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={generateTotpCode}
                          title="Refresh code"
                        >
                          <RefreshCw size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy('totp', totpCode)}
                        >
                          {copied.totp ? (
                            <Check size={16} className="text-green-600" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" onClick={generateTotpCode}>
                        Generate TOTP Code
                      </Button>
                    )}
                  </div>
                  {totpExpiresAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expires in {Math.ceil((totpExpiresAt.getTime() - Date.now()) / 1000)}s
                    </p>
                  )}
                </div>
              )}

              {/* Inbound SMS/email OTP inbox removed. Use TOTP (QR) for 2FA codes. */}

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {item.type === 'secure_note' ? 'Content' : 'Notes'}
                </label>
                <div className="mt-1 p-3 border rounded text-sm whitespace-pre-wrap">
                  {revealed?.notes || <span className="text-muted-foreground italic">No notes</span>}
                </div>
              </div>

              {item.tags && item.tags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {item.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-secondary rounded-md text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
      <AlertDialog {...alertDialog.props} />
    </Page>
  );
}

export default ItemDetail;

'use client';

import { useState } from 'react';
import { AlertTriangle, Ban, Flag, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { BanType, BanScope } from '@aardvark/shared';

interface UserActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  onWarn: (reason: string) => Promise<void>;
  onBan: (
    type: BanType,
    scope: BanScope,
    reason: string,
    durationDays?: number
  ) => Promise<void>;
}

type ActionType = 'warn' | 'temp_ban' | 'perm_ban' | 'shadow_ban';

const actionConfig: Record<
  ActionType,
  { label: string; icon: any; description: string; color: string }
> = {
  warn: {
    label: 'Issue Warning',
    icon: AlertTriangle,
    description: 'Send a warning to the user without restricting access',
    color: 'text-yellow-600',
  },
  temp_ban: {
    label: 'Temporary Ban',
    icon: Shield,
    description: 'Temporarily suspend user access for a specified duration',
    color: 'text-orange-600',
  },
  perm_ban: {
    label: 'Permanent Ban',
    icon: Ban,
    description: 'Permanently ban user from the platform',
    color: 'text-red-600',
  },
  shadow_ban: {
    label: 'Shadow Ban',
    icon: Flag,
    description: 'User can post but content is hidden from others',
    color: 'text-purple-600',
  },
};

const banScopes: { value: BanScope; label: string }[] = [
  { value: BanScope.FULL, label: 'Full Platform Access' },
  { value: BanScope.POSTING, label: 'Content Creation Only' },
  { value: BanScope.COMMENTING, label: 'Commenting Only' },
  { value: BanScope.MESSAGING, label: 'Messaging Only' },
];

/**
 * Modal for taking moderation actions on users
 */
export function UserActionModal({
  isOpen,
  onClose,
  userId,
  username,
  onWarn,
  onBan,
}: UserActionModalProps) {
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('7');
  const [scope, setScope] = useState<BanScope>(BanScope.FULL);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedAction || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      if (selectedAction === 'warn') {
        await onWarn(reason);
      } else {
        const banType: BanType =
          selectedAction === 'perm_ban'
            ? BanType.PERMANENT
            : selectedAction === 'shadow_ban'
            ? BanType.SHADOW
            : BanType.TEMPORARY;

        const durationDays =
          selectedAction === 'temp_ban' ? parseInt(duration) : undefined;

        await onBan(banType, scope, reason, durationDays);
      }
      handleClose();
    } catch (error) {
      console.error('Failed to execute user action:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setSelectedAction(null);
      setReason('');
      setDuration('7');
      setScope(BanScope.FULL);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Moderate User</DialogTitle>
          <DialogDescription>
            Take action on user: <strong>{username}</strong> (ID: {userId})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action selection */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Select Action</div>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(actionConfig) as ActionType[]).map((action) => {
                const config = actionConfig[action];
                const Icon = config.icon;
                const isSelected = selectedAction === action;

                return (
                  <button
                    key={action}
                    onClick={() => setSelectedAction(action)}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{config.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {config.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedAction && (
            <>
              {/* Ban scope (for bans only) */}
              {selectedAction !== 'warn' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ban Scope</label>
                  <select
                    className="w-full p-2 text-sm border rounded-md bg-background"
                    value={scope}
                    onChange={(e) => setScope(e.target.value as BanScope)}
                  >
                    {banScopes.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Duration (for temp ban only) */}
              {selectedAction === 'temp_ban' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration (days)</label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="7"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ban will automatically expire after {duration} day(s)
                  </p>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Reason (required) *
                </label>
                <textarea
                  className="w-full min-h-[100px] p-3 text-sm border rounded-md bg-background"
                  placeholder="Explain the reason for this action..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This reason will be logged and may be shown to the user
                </p>
              </div>

              {/* Warning */}
              {(selectedAction === 'perm_ban' || selectedAction === 'temp_ban') && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-destructive">
                    <strong>Warning:</strong> This action will{' '}
                    {selectedAction === 'perm_ban'
                      ? 'permanently ban the user'
                      : `ban the user for ${duration} days`}
                    . Make sure you have reviewed all relevant information.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedAction || !reason.trim() || isSubmitting}
            variant={
              selectedAction === 'perm_ban' || selectedAction === 'temp_ban'
                ? 'destructive'
                : 'default'
            }
          >
            {isSubmitting ? 'Processing...' : 'Confirm Action'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

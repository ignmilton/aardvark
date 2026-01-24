'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ModerationAction } from '@aardvark/shared';
import type {
  Report,
  ModerationQueueItem,
  ReportReason,
} from '@aardvark/shared';

interface ReportDetailModalProps {
  report?: Report;
  queueItem?: ModerationQueueItem;
  isOpen: boolean;
  onClose: () => void;
  onResolve: (action: ModerationAction, reason: string) => Promise<void>;
}

const reasonLabels: Record<ReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate_speech: 'Hate Speech',
  inappropriate_content: 'Inappropriate Content',
  copyright: 'Copyright Violation',
  impersonation: 'Impersonation',
  misinformation: 'Misinformation',
  self_harm: 'Self-harm Content',
  illegal_content: 'Illegal Content',
  other: 'Other',
};

const actionOptions: { value: ModerationAction; label: string; variant: 'default' | 'destructive' }[] = [
  { value: ModerationAction.APPROVE, label: 'Approve Content', variant: 'default' },
  { value: ModerationAction.REMOVE, label: 'Remove Content', variant: 'destructive' },
  { value: ModerationAction.WARN_USER, label: 'Warn User', variant: 'default' },
  { value: ModerationAction.TEMP_BAN, label: 'Temporary Ban', variant: 'destructive' },
  { value: ModerationAction.DISMISS, label: 'Dismiss Report', variant: 'default' },
  { value: ModerationAction.ESCALATE, label: 'Escalate to Admin', variant: 'default' },
];

/**
 * Modal for viewing and resolving content reports
 */
export function ReportDetailModal({
  report,
  queueItem,
  isOpen,
  onClose,
  onResolve,
}: ReportDetailModalProps) {
  const [selectedAction, setSelectedAction] = useState<ModerationAction | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleResolve = async () => {
    if (!selectedAction) return;

    setIsSubmitting(true);
    try {
      await onResolve(selectedAction, reasonText);
      onClose();
      setSelectedAction(null);
      setReasonText('');
    } catch (error) {
      console.error('Failed to resolve report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setSelectedAction(null);
      setReasonText('');
    }
  };

  if (!report && !queueItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            {report ? 'Report Details' : 'Moderation Review'}
          </DialogTitle>
          <DialogDescription>
            Review and take action on this {report ? 'report' : 'content'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Report information */}
          {report && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge>{reasonLabels[report.reason]}</Badge>
                <Badge variant="secondary" className={cn(
                  'text-xs',
                  report.priority === 'critical' && 'bg-red-100 text-red-700',
                  report.priority === 'high' && 'bg-orange-100 text-orange-700',
                  report.priority === 'medium' && 'bg-yellow-100 text-yellow-700',
                  report.priority === 'low' && 'bg-blue-100 text-blue-700'
                )}>
                  {report.priority.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Reported {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                </span>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Description</div>
                <p className="text-sm text-muted-foreground">
                  {report.description || 'No description provided'}
                </p>
              </div>

              {report.evidence.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-1">Evidence</div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {report.evidence.map((evidence, idx) => (
                      <li key={idx} className="truncate">
                        {evidence}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Queue item information */}
          {queueItem && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge>{queueItem.contentType}</Badge>
                <Badge variant="secondary">{queueItem.source}</Badge>
                <span className="text-xs text-muted-foreground">
                  {queueItem.reportCount} report(s)
                </span>
              </div>

              {queueItem.autoFlagReasons.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-1">Auto-flag Reasons</div>
                  <div className="flex flex-wrap gap-1">
                    {queueItem.autoFlagReasons.map((reason, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {queueItem.content != null && (
                <div>
                  <div className="text-sm font-medium mb-1">Content Preview</div>
                  <div className="p-3 bg-muted rounded-md text-sm max-h-48 overflow-y-auto">
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(queueItem.content, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action selection */}
          <div className="space-y-3 pt-4 border-t">
            <div className="text-sm font-medium">Select Action</div>
            <div className="grid grid-cols-2 gap-2">
              {actionOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={selectedAction === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedAction(option.value)}
                  className="justify-start"
                >
                  {option.label}
                </Button>
              ))}
            </div>

            {selectedAction && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Reason for action (required)
                </label>
                <textarea
                  className="w-full min-h-[100px] p-3 text-sm border rounded-md bg-background"
                  placeholder="Explain why you're taking this action..."
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleResolve}
            disabled={!selectedAction || !reasonText.trim() || isSubmitting}
          >
            {isSubmitting ? 'Processing...' : 'Resolve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Flag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  ModerationQueueItem,
  ContentType,
} from '@aardvark/shared';

interface ModerationQueueItemProps {
  item: ModerationQueueItem;
  onReview: (item: ModerationQueueItem) => void;
  onAssign?: (item: ModerationQueueItem) => void;
}

const priorityConfig = {
  critical: { color: 'bg-red-500', icon: AlertCircle, label: 'Critical' },
  high: { color: 'bg-orange-500', icon: AlertTriangle, label: 'High' },
  medium: { color: 'bg-yellow-500', icon: Flag, label: 'Medium' },
  low: { color: 'bg-blue-500', icon: Flag, label: 'Low' },
};

const statusConfig = {
  pending: { color: 'text-yellow-600 bg-yellow-100', label: 'Pending' },
  under_review: { color: 'text-blue-600 bg-blue-100', label: 'Under Review' },
  approved: { color: 'text-green-600 bg-green-100', label: 'Approved' },
  rejected: { color: 'text-red-600 bg-red-100', label: 'Rejected' },
  escalated: { color: 'text-purple-600 bg-purple-100', label: 'Escalated' },
  dismissed: { color: 'text-gray-600 bg-gray-100', label: 'Dismissed' },
};

const contentTypeLabels: Record<ContentType, string> = {
  story: 'Story',
  segment: 'Segment',
  comment: 'Comment',
  review: 'Review',
  forum_thread: 'Forum Thread',
  forum_post: 'Forum Post',
  message: 'Message',
  user_profile: 'User Profile',
  collection: 'Collection',
};

/**
 * Moderation queue item component
 * Displays a content item awaiting moderation with actions
 */
export function ModerationQueueItemComponent({
  item,
  onReview,
  onAssign,
}: ModerationQueueItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const PriorityIcon = priorityConfig[item.priority].icon;

  return (
    <Card className={cn('transition-shadow hover:shadow-md')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Priority indicator */}
            <div
              className={cn(
                'h-2 w-2 rounded-full flex-shrink-0',
                priorityConfig[item.priority].color
              )}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {contentTypeLabels[item.contentType]}
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn('text-xs', statusConfig[item.status].color)}
                >
                  {statusConfig[item.status].label}
                </Badge>
                {item.source === 'auto_flagged' && (
                  <Badge variant="secondary" className="text-xs">
                    Auto-flagged
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Flag className="h-3 w-3" />
                  {item.reportCount} {item.reportCount === 1 ? 'report' : 'reports'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(item.createdAt), {
                    addSuffix: true,
                  })}
                </span>
                {item.assignedModeratorId && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Assigned
                  </span>
                )}
              </div>
            </div>
          </div>

          <PriorityIcon
            className={cn(
              'h-5 w-5 flex-shrink-0',
              item.priority === 'critical' && 'text-red-500',
              item.priority === 'high' && 'text-orange-500',
              item.priority === 'medium' && 'text-yellow-500',
              item.priority === 'low' && 'text-blue-500'
            )}
          />
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="space-y-2">
          {/* Content preview */}
          <div className="text-sm">
            <div className="font-medium mb-1">Content ID: {item.contentId}</div>
            {item.autoFlagReasons.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Auto-flag reasons:</span>{' '}
                {item.autoFlagReasons.join(', ')}
              </div>
            )}
          </div>

          {/* Content snippet (if expanded) */}
          {isExpanded && item.content != null && (
            <div className="mt-3 p-3 bg-muted rounded-md text-sm">
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(item.content, null, 2).slice(0, 500)}
                {JSON.stringify(item.content).length > 500 && '...'}
              </pre>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Eye className="h-3 w-3 mr-1" />
          {isExpanded ? 'Hide' : 'Preview'}
        </Button>
        <Button size="sm" onClick={() => onReview(item)}>
          Review
        </Button>
        {onAssign && !item.assignedModeratorId && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAssign(item)}
          >
            Assign to Me
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

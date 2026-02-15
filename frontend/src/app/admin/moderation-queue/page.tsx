'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { ModerationQueueItemComponent } from '@/components/admin/moderation-queue-item';
import { ReportDetailModal } from '@/components/admin/report-detail-modal';
import { useModeration } from '@/hooks/use-moderation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ModerationQueueItem, ModerationAction } from '@aardvark/shared';

export default function ModerationQueuePage() {
  const { queue, isLoading, resolveItem } = useModeration();
  const [selectedItem, setSelectedItem] = useState<ModerationQueueItem | null>(null);

  const handleReview = (item: ModerationQueueItem) => {
    setSelectedItem(item);
  };

  const handleResolve = async (action: ModerationAction, reason: string) => {
    if (selectedItem) {
      await resolveItem(selectedItem.id, action, reason);
      setSelectedItem(null);
    }
  };

  return (
    <AdminLayout
      title="Moderation Queue"
      description="Review and manage flagged content"
      pendingQueue={queue?.length ?? 0}
    >
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="stories">Stories</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-4 mt-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading queue...</p>
          ) : queue?.length === 0 ? (
            <p className="text-muted-foreground">No items in queue</p>
          ) : (
            queue?.map((item: ModerationQueueItem) => (
              <ModerationQueueItemComponent
                key={item.id}
                item={item}
                onReview={handleReview}
              />
            ))
          )}
        </TabsContent>
        <TabsContent value="stories" className="space-y-4 mt-4">
          {queue
            ?.filter((item: ModerationQueueItem) => item.contentType === 'story')
            .map((item: ModerationQueueItem) => (
              <ModerationQueueItemComponent
                key={item.id}
                item={item}
                onReview={handleReview}
              />
            ))}
        </TabsContent>
        <TabsContent value="comments" className="space-y-4 mt-4">
          {queue
            ?.filter((item: ModerationQueueItem) => item.contentType === 'comment')
            .map((item: ModerationQueueItem) => (
              <ModerationQueueItemComponent
                key={item.id}
                item={item}
                onReview={handleReview}
              />
            ))}
        </TabsContent>
        <TabsContent value="users" className="space-y-4 mt-4">
          {queue
            ?.filter((item: ModerationQueueItem) => item.contentType === 'user')
            .map((item: ModerationQueueItem) => (
              <ModerationQueueItemComponent
                key={item.id}
                item={item}
                onReview={handleReview}
              />
            ))}
        </TabsContent>
      </Tabs>

      <ReportDetailModal
        queueItem={selectedItem ?? undefined}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onResolve={handleResolve}
      />
    </AdminLayout>
  );
}

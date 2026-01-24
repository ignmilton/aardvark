'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { sanitizeHtml } from '@/lib/sanitize';

interface BranchSubmission {
  id: string;
  segmentData: {
    title: string | null;
    content: string;
    isEnding: boolean;
    endingType: 'good' | 'bad' | 'neutral' | 'secret' | null;
  };
  choicesData: {
    choiceText: string;
    order: number;
  }[];
  submissionNote: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  submittedBy: {
    id: string;
    username: string;
    displayName: string;
  };
  parentSegment: {
    id: string;
    title: string | null;
  };
  reviewNote: string | null;
  createdAt: string;
}

interface ReviewDashboardProps {
  submissions: BranchSubmission[];
  onReview: (
    submissionId: string,
    status: 'approved' | 'rejected' | 'revision_requested',
    reviewNote?: string
  ) => Promise<void>;
  isLoading?: boolean;
}

export function ReviewDashboard({
  submissions,
  onReview,
  isLoading = false,
}: ReviewDashboardProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<BranchSubmission | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingSubmissions = submissions.filter((s) => s.status === 'pending');
  const reviewedSubmissions = submissions.filter((s) => s.status !== 'pending');

  const handleReviewClick = (submission: BranchSubmission) => {
    setSelectedSubmission(submission);
    setReviewNote('');
    setIsReviewModalOpen(true);
  };

  const handleReviewAction = async (status: 'approved' | 'rejected' | 'revision_requested') => {
    if (!selectedSubmission) return;

    setIsSubmitting(true);
    try {
      await onReview(selectedSubmission.id, status, reviewNote.trim() || undefined);
      setIsReviewModalOpen(false);
      setSelectedSubmission(null);
      setReviewNote('');
    } catch (error) {
      console.error('Failed to review submission:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      revision_requested: 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${styles[status as keyof typeof styles] || ''}`}>
        {status === 'revision_requested' ? 'Revision Requested' : status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Branch Submissions</h2>
          <p className="text-muted-foreground">
            Review and manage community-submitted branches
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">
            {pendingSubmissions.length} pending
          </span>
        </div>
      </div>

      {/* Pending Submissions */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Pending Review
        </h3>
        {pendingSubmissions.length === 0 ? (
          <div className="text-center py-8 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">No pending submissions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingSubmissions.map((submission) => (
              <div
                key={submission.id}
                className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {submission.segmentData.title || 'Untitled Segment'}
                      </span>
                      {getStatusBadge(submission.status)}
                      {submission.segmentData.isEnding && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded-full">
                          {submission.segmentData.endingType} ending
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      By <span className="font-medium">{submission.submittedBy.displayName}</span>
                      {' · '}
                      Connects from: {submission.parentSegment.title || 'Root'}
                      {' · '}
                      {formatDate(submission.createdAt)}
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Choice: &quot;{submission.choicesData[0]?.choiceText}&quot;
                    </p>
                    <p className="text-sm italic border-l-2 pl-3 text-muted-foreground">
                      &quot;{submission.submissionNote}&quot;
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleReviewClick(submission)}
                  >
                    Review
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review History */}
      {reviewedSubmissions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Review History
          </h3>
          <div className="space-y-2">
            {reviewedSubmissions.map((submission) => (
              <div
                key={submission.id}
                className="p-3 border rounded-lg bg-muted/20"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {submission.segmentData.title || 'Untitled Segment'}
                    </span>
                    <span className="text-muted-foreground text-sm ml-2">
                      by {submission.submittedBy.displayName}
                    </span>
                  </div>
                  {getStatusBadge(submission.status)}
                </div>
                {submission.reviewNote && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Review note: {submission.reviewNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle>Review Submission</DialogTitle>
              </DialogHeader>

              <div className="py-4 space-y-4">
                {/* Submission Info */}
                <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Submitted by</p>
                    <p className="font-medium">{selectedSubmission.submittedBy.displayName}</p>
                  </div>
                  <div className="border-l pl-4">
                    <p className="text-sm text-muted-foreground">Connects from</p>
                    <p className="font-medium">
                      {selectedSubmission.parentSegment.title || 'Root Segment'}
                    </p>
                  </div>
                  <div className="border-l pl-4">
                    <p className="text-sm text-muted-foreground">Submitted</p>
                    <p className="font-medium">{formatDate(selectedSubmission.createdAt)}</p>
                  </div>
                </div>

                {/* Choice Text */}
                <div>
                  <label className="block text-sm font-medium mb-2">Choice Text</label>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="italic">&quot;{selectedSubmission.choicesData[0]?.choiceText}&quot;</p>
                  </div>
                </div>

                {/* Content Preview */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {selectedSubmission.segmentData.title || 'Segment Content'}
                  </label>
                  <div
                    className="p-4 border rounded-lg bg-background max-h-60 overflow-y-auto prose prose-sm"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedSubmission.segmentData.content) }}
                  />
                </div>

                {/* Ending Info */}
                {selectedSubmission.segmentData.isEnding && (
                  <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>
                      This is a <strong>{selectedSubmission.segmentData.endingType}</strong> ending
                    </span>
                  </div>
                )}

                {/* Submission Note */}
                <div>
                  <label className="block text-sm font-medium mb-2">Submitter&apos;s Note</label>
                  <div className="p-3 bg-muted/30 rounded-lg italic">
                    &quot;{selectedSubmission.submissionNote}&quot;
                  </div>
                </div>

                {/* Review Note */}
                <div>
                  <label className="block text-sm font-medium mb-2">Your Review Note (Optional)</label>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Add feedback for the submitter..."
                    rows={3}
                    className="w-full px-3 py-2 border rounded-md resize-none"
                  />
                </div>
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsReviewModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReviewAction('revision_requested')}
                  disabled={isSubmitting}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  Request Revision
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReviewAction('rejected')}
                  disabled={isSubmitting}
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  Reject
                </Button>
                <Button
                  onClick={() => handleReviewAction('approved')}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? 'Processing...' : 'Approve'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

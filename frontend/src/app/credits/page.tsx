'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { CreditBundles } from '@/components/payments/credit-bundles';
import { Button } from '@/components/ui/button';
import { Coins, Gift, Clock, ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Transaction {
  id: string;
  type: 'purchase' | 'ad_watch' | 'story_unlock' | 'tip_sent' | 'tip_received' | 'refund';
  amount: number;
  description: string;
  createdAt: string;
}

export default function CreditsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTx, setIsLoadingTx] = useState(true);
  const [activeTab, setActiveTab] = useState<'buy' | 'history' | 'earn'>('buy');

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/credits');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load transaction history
  useEffect(() => {
    async function loadTransactions() {
      if (!isAuthenticated) return;

      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/credits/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setTransactions(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load transactions:', error);
      } finally {
        setIsLoadingTx(false);
      }
    }

    loadTransactions();
  }, [isAuthenticated]);

  const handlePurchaseSuccess = async () => {
    await refreshUser();
    toast.success('Credits added to your account!');
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'purchase':
      case 'tip_received':
      case 'refund':
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case 'story_unlock':
      case 'tip_sent':
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case 'ad_watch':
        return <Gift className="h-4 w-4 text-blue-500" />;
      default:
        return <Coins className="h-4 w-4" />;
    }
  };

  const formatTransactionType = (type: Transaction['type']) => {
    const labels: Record<string, string> = {
      purchase: 'Credit Purchase',
      ad_watch: 'Ad Reward',
      story_unlock: 'Story Unlock',
      tip_sent: 'Tip Sent',
      tip_received: 'Tip Received',
      refund: 'Refund',
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header with Balance */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Your Credits</h1>
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary/10 rounded-full">
            <Coins className="h-6 w-6 text-primary" />
            <span className="text-3xl font-bold">{user.creditsBalance || 0}</span>
            <span className="text-muted-foreground">credits</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-8">
          {[
            { id: 'buy', label: 'Buy Credits', icon: Coins },
            { id: 'earn', label: 'Earn Free', icon: Gift },
            { id: 'history', label: 'History', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'buy' && (
          <CreditBundles onPurchaseSuccess={handlePurchaseSuccess} />
        )}

        {activeTab === 'earn' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold mb-2">Earn Free Credits</h2>
              <p className="text-muted-foreground">
                Watch short ads to earn credits for free. Up to 50 credits per day!
              </p>
            </div>

            <div className="max-w-md mx-auto p-6 border rounded-xl text-center">
              <Gift className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Watch an Ad</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Watch a 30-second ad to earn 1 credit. You can watch up to 50 ads per day.
              </p>
              <Button className="w-full">
                Watch Ad (+1 Credit)
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Daily limit: 0/50 ads watched
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mt-8">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Daily Login Bonus</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Log in every day to earn bonus credits
                </p>
                <Button variant="outline" size="sm" disabled>
                  Claimed Today
                </Button>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Refer Friends</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Earn 50 credits for each friend who signs up
                </p>
                <Button variant="outline" size="sm">
                  Get Referral Link
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Transaction History</h2>

            {isLoadingTx ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions yet</p>
                <p className="text-sm">Your credit purchases and spending will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getTransactionIcon(tx.type)}
                      <div>
                        <p className="font-medium">{formatTransactionType(tx.type)}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

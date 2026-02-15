import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - Aardvark',
  description: 'Privacy Policy for the Aardvark interactive fiction platform.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2026</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <h2>1. Introduction</h2>
          <p>
            At Aardvark, we take your privacy seriously. This Privacy Policy explains how we collect,
            use, disclose, and safeguard your information when you use our platform.
          </p>

          <h2>2. Information We Collect</h2>

          <h3>Information You Provide</h3>
          <ul>
            <li><strong>Account Information:</strong> Username, email address, password, display name</li>
            <li><strong>Profile Information:</strong> Bio, avatar, social links</li>
            <li><strong>Content:</strong> Stories, comments, ratings, and other content you create</li>
            <li><strong>Payment Information:</strong> Billing details processed through our payment providers</li>
            <li><strong>Communications:</strong> Messages you send us or other users</li>
          </ul>

          <h3>Information Collected Automatically</h3>
          <ul>
            <li><strong>Usage Data:</strong> Pages visited, features used, reading progress</li>
            <li><strong>Device Information:</strong> Browser type, operating system, device identifiers</li>
            <li><strong>Log Data:</strong> IP addresses, access times, referring URLs</li>
            <li><strong>Cookies:</strong> Session cookies and preference cookies</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>We use collected information to:</p>
          <ul>
            <li>Provide and maintain the Platform</li>
            <li>Process transactions and send related information</li>
            <li>Send notifications about your account or activities</li>
            <li>Respond to your comments, questions, and requests</li>
            <li>Personalize your experience and provide recommendations</li>
            <li>Monitor and analyze usage patterns and trends</li>
            <li>Detect, prevent, and address technical issues and fraud</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2>4. Information Sharing</h2>
          <p>We may share your information with:</p>
          <ul>
            <li><strong>Service Providers:</strong> Companies that help us operate the Platform</li>
            <li><strong>Payment Processors:</strong> For handling transactions</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            <li><strong>Business Transfers:</strong> In connection with a merger or acquisition</li>
          </ul>
          <p>
            We do not sell your personal information to third parties.
          </p>

          <h2>5. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your personal
            information, including encryption, secure servers, and access controls. However, no
            method of transmission over the Internet is 100% secure.
          </p>

          <h2>6. Your Rights</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul>
            <li>Access and receive a copy of your personal data</li>
            <li>Rectify or update inaccurate personal data</li>
            <li>Request deletion of your personal data</li>
            <li>Object to or restrict processing of your data</li>
            <li>Data portability</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p>
            To exercise these rights, visit your{' '}
            <Link href="/settings" className="text-primary hover:underline">
              account settings
            </Link>{' '}
            or contact us.
          </p>

          <h2>7. Data Retention</h2>
          <p>
            We retain your personal information for as long as your account is active or as needed
            to provide services. We may retain certain information as required by law or for
            legitimate business purposes.
          </p>

          <h2>8. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies to:
          </p>
          <ul>
            <li>Keep you signed in</li>
            <li>Remember your preferences</li>
            <li>Understand how you use the Platform</li>
            <li>Improve our services</li>
          </ul>
          <p>
            You can control cookies through your browser settings, though some features may not
            function properly without cookies.
          </p>

          <h2>9. Children&apos;s Privacy</h2>
          <p>
            The Platform is not intended for users under 13 years of age. We do not knowingly
            collect personal information from children under 13. If we learn we have collected
            such information, we will delete it.
          </p>

          <h2>10. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries other than your own.
            We ensure appropriate safeguards are in place for such transfers.
          </p>

          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes
            by posting the new policy on this page and updating the &quot;Last updated&quot; date.
          </p>

          <h2>12. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or our privacy practices, please
            contact us at{' '}
            <a href="mailto:privacy@aardvark.com">privacy@aardvark.com</a>.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t text-center">
          <p className="text-muted-foreground">
            See also our{' '}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service - Aardvark',
  description: 'Terms of Service for the Aardvark interactive fiction platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2026</p>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Aardvark (&quot;the Platform&quot;), you agree to be bound by these Terms of
            Service. If you do not agree to these terms, please do not use the Platform.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Aardvark is an interactive fiction platform that allows users to read and create
            branching narrative stories. The Platform includes features for reading stories,
            creating content, managing accounts, and participating in the community.
          </p>

          <h2>3. User Accounts</h2>
          <p>
            To access certain features, you must create an account. You are responsible for:
          </p>
          <ul>
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activities that occur under your account</li>
            <li>Providing accurate and complete registration information</li>
            <li>Notifying us immediately of any unauthorized use of your account</li>
          </ul>

          <h2>4. User Content</h2>
          <p>
            You retain ownership of content you create on the Platform. By posting content, you grant
            Aardvark a non-exclusive, worldwide, royalty-free license to use, display, and distribute
            your content on the Platform.
          </p>
          <p>You agree not to post content that:</p>
          <ul>
            <li>Infringes on intellectual property rights</li>
            <li>Contains illegal, harmful, or offensive material</li>
            <li>Violates the privacy of others</li>
            <li>Contains malware or harmful code</li>
          </ul>

          <h2>5. Prohibited Activities</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Platform for any illegal purpose</li>
            <li>Attempt to gain unauthorized access to the Platform</li>
            <li>Interfere with other users&apos; enjoyment of the Platform</li>
            <li>Use automated systems to access the Platform without permission</li>
            <li>Impersonate others or misrepresent your affiliation</li>
          </ul>

          <h2>6. Premium Features and Payments</h2>
          <p>
            Some features require payment or subscription. By purchasing premium features, you agree
            to our pricing and payment terms. Refunds are handled according to our refund policy.
          </p>

          <h2>7. Intellectual Property</h2>
          <p>
            The Platform, including its design, features, and content (excluding user content), is
            owned by Aardvark. You may not copy, modify, or distribute our intellectual property
            without permission.
          </p>

          <h2>8. Termination</h2>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms. You may
            also delete your account at any time through your account settings.
          </p>

          <h2>9. Disclaimer of Warranties</h2>
          <p>
            The Platform is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
            that the Platform will be uninterrupted, secure, or error-free.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Aardvark shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising from your use of the
            Platform.
          </p>

          <h2>11. Changes to Terms</h2>
          <p>
            We may update these terms from time to time. Continued use of the Platform after changes
            constitutes acceptance of the new terms.
          </p>

          <h2>12. Contact Us</h2>
          <p>
            If you have questions about these Terms of Service, please contact us at{' '}
            <a href="mailto:legal@aardvark.com">legal@aardvark.com</a>.
          </p>
        </div>

        <div className="mt-12 pt-8 border-t text-center">
          <p className="text-muted-foreground">
            By using Aardvark, you agree to these terms. See also our{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

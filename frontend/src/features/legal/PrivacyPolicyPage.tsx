import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 sm:p-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Last updated: February 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">1. Introduction</h2>
          <p className="text-gray-600 leading-relaxed">
            ExamRevise Zimbabwe ("we", "our", or "us") is committed to protecting the privacy
            of our users. This Privacy Policy explains how we collect, use, disclose, and
            safeguard your information when you use our exam preparation platform, including
            our website and any related services (collectively, the "Service").
          </p>
          <p className="text-gray-600 leading-relaxed">
            By using the Service, you agree to the collection and use of information in
            accordance with this policy. If you do not agree with the terms of this policy,
            please do not access the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">2. Information We Collect</h2>
          <h3 className="text-lg font-medium text-gray-800">Personal Information</h3>
          <p className="text-gray-600 leading-relaxed">
            When you create an account, we may collect:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
            <li>Full name</li>
            <li>Email address</li>
            <li>School or institution name</li>
            <li>Grade or form level</li>
            <li>Account credentials (passwords are encrypted)</li>
          </ul>
          <h3 className="text-lg font-medium text-gray-800 mt-4">Usage Data</h3>
          <p className="text-gray-600 leading-relaxed">
            We automatically collect certain information when you use our Service, including:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
            <li>Exam attempts and answers submitted</li>
            <li>Scores and performance data</li>
            <li>Pages visited and time spent on the platform</li>
            <li>Device type, browser type, and operating system</li>
            <li>IP address and approximate location</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">3. How We Use Your Information</h2>
          <p className="text-gray-600 leading-relaxed">We use your information to:</p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
            <li>Provide and maintain the Service</li>
            <li>Process your exam attempts and deliver AI-powered feedback</li>
            <li>Track your progress and generate performance analytics</li>
            <li>Enable teachers to monitor student performance (for class features)</li>
            <li>Send you important updates about the Service</li>
            <li>Improve and personalise your experience</li>
            <li>Ensure the security of the platform</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">4. AI-Powered Features</h2>
          <p className="text-gray-600 leading-relaxed">
            Our Service uses artificial intelligence to mark exam answers and provide feedback.
            Your answers may be processed by third-party AI providers (such as Anthropic) to
            generate marking and feedback. We do not use your answers to train AI models.
            AI-generated marks and feedback are for educational guidance and should not be
            considered official examination results.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">5. Data Sharing and Disclosure</h2>
          <p className="text-gray-600 leading-relaxed">
            We do not sell your personal information. We may share your information with:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
            <li>Teachers and school administrators (for enrolled students only)</li>
            <li>Parents or guardians (for linked student accounts)</li>
            <li>Service providers who assist in operating our platform (hosting, AI processing)</li>
            <li>Law enforcement when required by applicable Zimbabwean law</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">6. Data Security</h2>
          <p className="text-gray-600 leading-relaxed">
            We implement appropriate technical and organisational security measures to protect
            your personal data, including encryption of data in transit (HTTPS) and at rest,
            secure password hashing, and access controls. However, no method of electronic
            storage is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">7. Data Retention</h2>
          <p className="text-gray-600 leading-relaxed">
            We retain your personal data for as long as your account is active or as needed
            to provide the Service. You may request deletion of your account and associated
            data at any time by contacting us. We may retain certain data as required by law
            or for legitimate business purposes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">8. Children's Privacy</h2>
          <p className="text-gray-600 leading-relaxed">
            Our Service is designed for students, including those under 18. For users under 18,
            we encourage parental guidance when creating accounts. We do not knowingly collect
            unnecessary personal information from minors. Parents or guardians may contact us
            to review, delete, or manage their child's information.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">9. Your Rights</h2>
          <p className="text-gray-600 leading-relaxed">You have the right to:</p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
            <li>Access and receive a copy of your personal data</li>
            <li>Correct inaccurate or incomplete personal data</li>
            <li>Request deletion of your personal data</li>
            <li>Object to or restrict processing of your data</li>
            <li>Download your exam data in a portable format</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">10. Changes to This Policy</h2>
          <p className="text-gray-600 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any
            changes by posting the new policy on this page and updating the "Last updated"
            date. Continued use of the Service after changes constitutes acceptance of the
            revised policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">11. Contact Us</h2>
          <p className="text-gray-600 leading-relaxed">
            If you have any questions about this Privacy Policy, please contact us at:
          </p>
          <p className="text-gray-600">
            Email:{' '}
            <a href="mailto:support@examrevise.co.zw" className="text-primary-600 hover:underline">
              support@examrevise.co.zw
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}

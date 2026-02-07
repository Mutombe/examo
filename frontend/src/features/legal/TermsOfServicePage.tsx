import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function TermsOfServicePage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500">Last updated: February 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">1. Acceptance of Terms</h2>
          <p className="text-gray-600 leading-relaxed">
            By accessing or using ExamRevise Zimbabwe (the "Service"), you agree to be bound
            by these Terms of Service ("Terms"). If you do not agree to these Terms, you may
            not access or use the Service. If you are under 18, you represent that your parent
            or guardian has reviewed and agreed to these Terms on your behalf.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">2. Description of Service</h2>
          <p className="text-gray-600 leading-relaxed">
            ExamRevise Zimbabwe is an AI-powered exam preparation platform that provides:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
            <li>Access to ZIMSEC and Cambridge past examination papers</li>
            <li>AI-powered marking and feedback on student answers</li>
            <li>Progress tracking and performance analytics</li>
            <li>Teacher and school administration tools</li>
            <li>Study resources and a learning library</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">3. User Accounts</h2>
          <p className="text-gray-600 leading-relaxed">
            To access certain features, you must create an account. You agree to:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
            <li>Provide accurate and complete registration information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Notify us immediately of any unauthorised access to your account</li>
            <li>Accept responsibility for all activities under your account</li>
          </ul>
          <p className="text-gray-600 leading-relaxed">
            We reserve the right to suspend or terminate accounts that violate these Terms
            or engage in misuse of the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">4. Guest Access</h2>
          <p className="text-gray-600 leading-relaxed">
            Certain features of the Service are available without creating an account.
            Guest users may browse papers, attempt questions, and receive AI feedback.
            Guest progress is stored locally and may be lost if browser data is cleared.
            Creating an account is recommended for a full experience with persistent
            progress tracking.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">5. Acceptable Use</h2>
          <p className="text-gray-600 leading-relaxed">You agree not to:</p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
            <li>Use the Service for any unlawful purpose</li>
            <li>Share your account credentials with others</li>
            <li>Attempt to access other users' accounts or data</li>
            <li>Interfere with or disrupt the Service or its infrastructure</li>
            <li>Scrape, copy, or redistribute exam content without authorisation</li>
            <li>Submit offensive, harmful, or inappropriate content as answers</li>
            <li>Use the Service to cheat in actual examinations</li>
            <li>Attempt to manipulate AI marking results</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">6. AI Marking Disclaimer</h2>
          <p className="text-gray-600 leading-relaxed">
            The AI-powered marking and feedback provided by our Service is for educational
            and practice purposes only. AI marks:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
            <li>Are not official examination results</li>
            <li>May not perfectly reflect actual exam board marking standards</li>
            <li>Should be used as guidance for improvement, not definitive assessment</li>
            <li>Are generated by third-party AI technology and may occasionally contain errors</li>
          </ul>
          <p className="text-gray-600 leading-relaxed">
            We strive for accuracy but do not guarantee that AI marks will match those of
            official examiners. ExamRevise is not affiliated with ZIMSEC, Cambridge Assessment,
            or any official examination board.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">7. Intellectual Property</h2>
          <p className="text-gray-600 leading-relaxed">
            Past examination papers are the intellectual property of their respective
            examination boards (ZIMSEC, Cambridge Assessment International Education, etc.).
            These papers are provided on our platform for educational purposes under fair use
            principles. You may not reproduce, distribute, or commercially exploit examination
            content obtained from our Service.
          </p>
          <p className="text-gray-600 leading-relaxed">
            The ExamRevise platform, including its design, code, AI systems, and original
            content, is owned by ExamRevise Zimbabwe and protected by applicable intellectual
            property laws.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">8. Teacher and School Accounts</h2>
          <p className="text-gray-600 leading-relaxed">
            Teachers and school administrators who use our platform agree to:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
            <li>Use student data only for legitimate educational purposes</li>
            <li>Maintain confidentiality of student performance data</li>
            <li>Ensure appropriate consent for student enrolment</li>
            <li>Comply with applicable data protection regulations</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">9. Limitation of Liability</h2>
          <p className="text-gray-600 leading-relaxed">
            To the fullest extent permitted by law, ExamRevise Zimbabwe shall not be liable
            for any indirect, incidental, special, consequential, or punitive damages arising
            from your use of the Service. This includes but is not limited to:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
            <li>Loss of data or exam progress</li>
            <li>Inaccurate AI marking or feedback</li>
            <li>Service interruptions or downtime</li>
            <li>Reliance on AI-generated scores for exam preparation decisions</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">10. Service Availability</h2>
          <p className="text-gray-600 leading-relaxed">
            We strive to maintain the Service's availability but do not guarantee uninterrupted
            access. We may temporarily suspend the Service for maintenance, updates, or
            circumstances beyond our control. We reserve the right to modify, suspend, or
            discontinue any part of the Service at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">11. Changes to Terms</h2>
          <p className="text-gray-600 leading-relaxed">
            We may update these Terms from time to time. We will notify users of material
            changes by posting the updated Terms on this page with a revised "Last updated"
            date. Continued use of the Service after changes constitutes acceptance of the
            new Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">12. Governing Law</h2>
          <p className="text-gray-600 leading-relaxed">
            These Terms shall be governed by and construed in accordance with the laws of
            the Republic of Zimbabwe. Any disputes arising from these Terms or the Service
            shall be subject to the exclusive jurisdiction of the courts of Zimbabwe.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">13. Contact Us</h2>
          <p className="text-gray-600 leading-relaxed">
            If you have any questions about these Terms of Service, please contact us at:
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

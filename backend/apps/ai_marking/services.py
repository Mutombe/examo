"""
AI Marking Service using Anthropic Claude API.
"""

import json
import logging
import time
from decimal import Decimal
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class AIMarkingService:
    """Service for marking student answers using Claude AI."""

    MODEL = "claude-sonnet-4-20250514"

    def __init__(self):
        self.api_key = settings.ANTHROPIC_API_KEY
        self.client = None

        if self.api_key:
            try:
                import anthropic
                self.client = anthropic.Anthropic(api_key=self.api_key)
            except ImportError:
                logger.warning("anthropic package not installed")
            except Exception as e:
                logger.error(f"Failed to initialize Anthropic client: {e}")

    def mark_answer(self, answer, log_marking=True):
        """
        Mark a student's answer using AI.

        Args:
            answer: Answer model instance
            log_marking: Whether to log the marking to AIMarkingLog

        Returns:
            bool: True if marking was successful
        """
        question = answer.question

        # Skip if no answer provided
        if not answer.answer_text.strip():
            answer.score = Decimal('0')
            answer.feedback = "No answer provided."
            answer.is_correct = False
            answer.ai_marked = True
            answer.marked_at = timezone.now()
            answer.confidence_score = 1.0
            answer.confidence_level = 'high'
            answer.save()
            return True

        # Build the marking prompt
        prompt = self._build_marking_prompt(question, answer)

        # If no API client, use fallback marking
        if not self.client:
            return self._fallback_marking(answer, question)

        start_time = time.time()

        try:
            response = self.client.messages.create(
                model=self.MODEL,
                max_tokens=1500,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                system=self._get_system_prompt(question.question_type)
            )

            latency_ms = int((time.time() - start_time) * 1000)
            response_text = response.content[0].text
            tokens_used = response.usage.input_tokens + response.usage.output_tokens

            # Parse the response
            result = self._parse_marking_response(response_text, question.marks)

            answer.score = Decimal(str(result['score']))
            answer.feedback = result['feedback']
            answer.is_correct = result['score'] >= (question.marks * 0.5)
            answer.ai_marked = True
            answer.marked_at = timezone.now()

            # Set confidence - cap at medium when no marking scheme
            raw_confidence = result.get('confidence', 0.8)
            if not question.marking_scheme and raw_confidence > 0.79:
                raw_confidence = 0.79
            answer.confidence_score = raw_confidence
            answer.confidence_level = (
                'high' if raw_confidence >= 0.8 else
                'medium' if raw_confidence >= 0.5 else
                'low'
            )
            answer.save()

            # Log the marking
            if log_marking:
                self._log_marking(
                    answer=answer,
                    prompt=prompt,
                    response=response_text,
                    tokens_used=tokens_used,
                    latency_ms=latency_ms,
                    marks_awarded=result['score'],
                    confidence=result.get('confidence', 0.8)
                )

            return True

        except Exception as e:
            logger.error(f"AI marking failed: {e}")
            return self._fallback_marking(answer, question)

    def _get_system_prompt(self, question_type):
        """Get type-specific system prompt."""
        base = """You are an experienced examination marker for Zimbabwean secondary school examinations (ZIMSEC and Cambridge).

Your task is to mark student answers fairly and provide constructive feedback.

Key principles:
- Award marks for correct content, not presentation
- Accept alternative correct answers
- Partial marks for partially correct answers
- Clear, encouraging feedback that helps students improve
- Be consistent with mark allocation

When marking, consider:
1. Accuracy of the content
2. Completeness of the answer
3. Clarity of explanation
4. Use of correct terminology
5. Partial credit for partially correct answers

Always respond in the following JSON format:
{
    "score": <number between 0 and max_marks>,
    "feedback": "<constructive feedback explaining the score>",
    "breakdown": [
        {
            "criterion": "<marking point>",
            "marks_possible": <number>,
            "marks_awarded": <number>,
            "comment": "<specific feedback for this criterion>"
        }
    ],
    "correct_points": ["<point 1>", "<point 2>"],
    "missing_points": ["<point 1>", "<point 2>"],
    "suggestions": "<how to improve>",
    "confidence": <0.0-1.0>
}

Be encouraging but honest. Focus on learning and improvement."""

        type_specific = {
            'mcq': "\nFor multiple choice, simply verify if the selected option is correct.",
            'short_answer': "\nLook for key terms and concepts. Accept synonyms and alternative phrasings.",
            'long_answer': "\nAssess content, structure, and argument quality. Look for relevant examples.",
            'structured': "\nMark each part separately. Later parts may depend on earlier answers.",
            'essay': "\nAssess content, structure, argument quality, and evidence use.",
        }

        return base + type_specific.get(question_type, "")

    def _build_marking_prompt(self, question, answer):
        """Build the prompt for marking an answer."""
        prompt_parts = [
            f"Please mark the following student answer.\n",
            f"**Question ({question.marks} marks):**",
            f"{question.question_text}\n",
        ]

        if question.marking_scheme:
            prompt_parts.append(f"**Official Marking Scheme:**\n{question.marking_scheme}\n")

        if question.sample_answer:
            prompt_parts.append(f"**Model Answer:**\n{question.sample_answer}\n")

        prompt_parts.extend([
            f"**Student's Answer:**",
            f"{answer.answer_text}\n",
            f"Please evaluate this answer out of {question.marks} marks and provide detailed feedback.",
        ])

        return "\n".join(prompt_parts)

    def _parse_marking_response(self, response_text, max_marks):
        """Parse the AI's marking response."""
        try:
            # Try to extract JSON from the response
            start = response_text.find('{')
            end = response_text.rfind('}') + 1

            if start != -1 and end > start:
                json_str = response_text[start:end]
                result = json.loads(json_str)

                # Validate and clamp score
                score = float(result.get('score', 0))
                score = max(0, min(score, max_marks))

                # Build feedback
                feedback_parts = [result.get('feedback', '')]

                # Add breakdown if available
                breakdown = result.get('breakdown', [])
                if breakdown:
                    feedback_parts.append("\n\n**Marking Breakdown:**")
                    for item in breakdown:
                        criterion = item.get('criterion', '')
                        awarded = item.get('marks_awarded', 0)
                        possible = item.get('marks_possible', 0)
                        comment = item.get('comment', '')
                        feedback_parts.append(f"- {criterion}: {awarded}/{possible} marks")
                        if comment:
                            feedback_parts.append(f"  {comment}")

                correct_points = result.get('correct_points', [])
                if correct_points:
                    feedback_parts.append("\n\n**What you did well:**")
                    for point in correct_points:
                        feedback_parts.append(f"- {point}")

                missing_points = result.get('missing_points', [])
                if missing_points:
                    feedback_parts.append("\n\n**Points to improve:**")
                    for point in missing_points:
                        feedback_parts.append(f"- {point}")

                suggestions = result.get('suggestions', '')
                if suggestions:
                    feedback_parts.append(f"\n\n**Study tip:** {suggestions}")

                return {
                    'score': score,
                    'feedback': '\n'.join(feedback_parts),
                    'confidence': result.get('confidence', 0.8),
                    'breakdown': breakdown
                }
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"Failed to parse AI response: {e}")

        # Return a safe default if parsing fails
        return {
            'score': max_marks * 0.5,
            'feedback': "Your answer has been reviewed. Please consult your teacher for detailed feedback.",
            'confidence': 0.5
        }

    def _fallback_marking(self, answer, question):
        """Fallback marking when AI is unavailable."""
        answer_text = answer.answer_text.strip()
        max_marks = question.marks

        if not answer_text:
            score = 0
            feedback = "No answer provided."
        elif len(answer_text) < 20:
            score = max_marks * 0.25
            feedback = "Your answer is very brief. Try to provide more detail and explanation."
        elif len(answer_text) < 50:
            score = max_marks * 0.5
            feedback = "Your answer shows some understanding. Consider expanding with more details."
        else:
            score = max_marks * 0.6
            feedback = "Your answer has been recorded. Detailed AI feedback is currently unavailable."

        answer.score = Decimal(str(round(score, 2)))
        answer.feedback = feedback
        answer.is_correct = score >= (max_marks * 0.5)
        answer.ai_marked = False
        answer.marked_at = timezone.now()
        answer.confidence_score = 0.3
        answer.confidence_level = 'low'
        answer.save()

        return True

    def _log_marking(self, answer, prompt, response, tokens_used, latency_ms, marks_awarded, confidence):
        """Log the marking to AIMarkingLog."""
        try:
            from apps.progress.models import AIMarkingLog
            AIMarkingLog.objects.create(
                answer=answer,
                prompt_sent=prompt,
                model_used=self.MODEL,
                response_received=response,
                tokens_used=tokens_used,
                latency_ms=latency_ms,
                marks_awarded=int(marks_awarded),
                confidence_score=confidence
            )
        except Exception as e:
            logger.error(f"Failed to log AI marking: {e}")

    def generate_marking_scheme(self, question):
        """
        Generate a marking scheme for a question that doesn't have one.

        Args:
            question: Question model instance

        Returns:
            str: Generated marking scheme or None if failed
        """
        if not self.client:
            return None

        syllabus = question.paper.syllabus
        prompt = f"""Generate a detailed marking scheme for this examination question.

**Context:**
- Examination Board: {syllabus.board.name}
- Subject: {syllabus.subject.name}
- Level: {syllabus.get_level_display()}

**Question ({question.marks} marks):**
{question.question_text}

**Task:**
Create a marking scheme that specifies:
1. Key points that must be included for full marks
2. How partial marks should be awarded
3. Alternative acceptable answers
4. Common errors to watch for

Format your response as a clear marking scheme that a teacher could use."""

        try:
            response = self.client.messages.create(
                model=self.MODEL,
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"Failed to generate marking scheme: {e}")
            return None


class ClassAnalyticsService:
    """AI-powered insights for teacher dashboards."""

    def __init__(self):
        self.api_key = settings.ANTHROPIC_API_KEY
        self.client = None

        if self.api_key:
            try:
                import anthropic
                self.client = anthropic.Anthropic(api_key=self.api_key)
            except ImportError:
                pass

    def generate_class_insights(self, class_obj, topic_performance):
        """
        Generate actionable insights for a teacher about their class.

        Args:
            class_obj: Class model instance
            topic_performance: List of dicts with topic performance data

        Returns:
            dict: Insights about the class
        """
        if not self.client or not topic_performance:
            return self._default_insights()

        prompt = f"""Analyze this class's performance and provide actionable insights.

**Class Information:**
- Subject: {class_obj.subject.name}
- Form Level: {class_obj.form_level}
- Number of Students: {class_obj.student_count}

**Topic Performance Data:**
{json.dumps(topic_performance, indent=2)}

**Provide insights in JSON format:**
{{
    "strengths": ["<topic/area 1>", "<topic/area 2>"],
    "weaknesses": ["<topic/area needing attention>"],
    "recommendations": ["<specific teaching recommendation>"],
    "students_needing_help": ["<pattern or criteria>"],
    "suggested_focus": "<what to focus on next>"
}}"""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )

            text = response.content[0].text
            start = text.find('{')
            end = text.rfind('}') + 1

            if start != -1 and end > start:
                return json.loads(text[start:end])
        except Exception as e:
            logger.error(f"Failed to generate class insights: {e}")

        return self._default_insights()

    def _default_insights(self):
        """Return default insights when AI is unavailable."""
        return {
            "strengths": [],
            "weaknesses": [],
            "recommendations": ["Review class performance data to identify areas for improvement."],
            "students_needing_help": [],
            "suggested_focus": "Continue with the current syllabus and monitor student progress."
        }

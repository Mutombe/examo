"""
Paper Processing Service - Extract questions from uploaded PDFs using AI.
Supports both text-based and image-based (scanned) PDFs using Claude's vision.
"""

import base64
import json
import logging
import os
import re
import tempfile
from decimal import Decimal
from django.conf import settings
from django.core.files.storage import default_storage

logger = logging.getLogger(__name__)


def _get_local_path(pdf_file):
    """Get a local file path for a PDF, downloading from storage if needed.
    Returns (path, is_temp) tuple. Caller must delete temp files."""
    # Try local path first
    try:
        if hasattr(pdf_file, 'path'):
            path = pdf_file.path
            if os.path.exists(path):
                return path, False
    except NotImplementedError:
        pass

    try:
        path = default_storage.path(pdf_file.name)
        if os.path.exists(path):
            return path, False
    except (NotImplementedError, AttributeError):
        pass

    # Download from storage to temp file
    logger.info(f"Downloading {pdf_file.name} from storage to temp file")
    suffix = os.path.splitext(pdf_file.name)[1] or '.pdf'
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        with pdf_file.open('rb') as f:
            for chunk in f.chunks(8192):
                tmp.write(chunk)
        tmp.close()
        return tmp.name, True
    except Exception as e:
        tmp.close()
        os.unlink(tmp.name)
        raise e


class PaperProcessingService:
    """Service for processing uploaded papers and extracting questions using AI."""

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

    def extract_text_from_pdf(self, pdf_file):
        """
        Extract text content from a PDF file.
        Works with both local and cloud (S3) storage backends.
        """
        pdf_path, is_temp = _get_local_path(pdf_file)
        try:
            import fitz
            doc = fitz.open(pdf_path)
            text_parts = []
            for page_num in range(len(doc)):
                page = doc[page_num]
                text_parts.append(f"\n--- Page {page_num + 1} ---\n")
                text_parts.append(page.get_text())
            doc.close()
            return ''.join(text_parts)
        except ImportError:
            logger.info("PyMuPDF not available, trying PyPDF2")
        except Exception as e:
            logger.error(f"Failed to extract PDF text with fitz: {e}")
        finally:
            if is_temp:
                os.unlink(pdf_path)

        # Fallback to PyPDF2
        pdf_path, is_temp = _get_local_path(pdf_file)
        try:
            from PyPDF2 import PdfReader
            with open(pdf_path, 'rb') as f:
                reader = PdfReader(f)
                text_parts = []
                for i, page in enumerate(reader.pages):
                    text_parts.append(f"\n--- Page {i + 1} ---\n")
                    text_parts.append(page.extract_text() or '')
                return ''.join(text_parts)
        except ImportError:
            logger.error("No PDF library available. Install PyMuPDF or PyPDF2.")
            return None
        except Exception as e:
            logger.error(f"Failed to extract PDF text: {e}")
            return None
        finally:
            if is_temp:
                os.unlink(pdf_path)

    def convert_pdf_to_images(self, pdf_file, max_pages=20, dpi=150, use_jpeg=True):
        """
        Convert PDF pages to base64-encoded images for vision processing.
        Works with both local and cloud (S3) storage backends.
        Uses JPEG by default for much smaller payload sizes with scanned PDFs.
        """
        pdf_path, is_temp = _get_local_path(pdf_file)
        try:
            import fitz  # PyMuPDF

            doc = fitz.open(pdf_path)
            images = []
            fmt = "jpeg" if use_jpeg else "png"

            num_pages = min(len(doc), max_pages)

            for page_num in range(num_pages):
                page = doc[page_num]
                mat = fitz.Matrix(dpi/72, dpi/72)
                pix = page.get_pixmap(matrix=mat)
                if use_jpeg:
                    img_bytes = pix.tobytes("jpeg", jpg_quality=60)
                else:
                    img_bytes = pix.tobytes("png")
                img_base64 = base64.standard_b64encode(img_bytes).decode('utf-8')
                images.append(img_base64)
                logger.info(f"Converted page {page_num + 1} to {fmt} ({dpi} DPI, {len(img_bytes)//1024}KB)")

            doc.close()
            return images, fmt

        except ImportError:
            logger.error("PyMuPDF (fitz) is required for image-based PDF processing")
            return None
        except Exception as e:
            logger.error(f"Failed to convert PDF to images: {e}")
            return None
        finally:
            if is_temp:
                os.unlink(pdf_path)

    def _has_meaningful_text(self, text):
        """Check if extracted text has meaningful content (not just page markers or scanner artifacts)."""
        if not text:
            return False
        # Remove page markers and whitespace
        cleaned = re.sub(r'---\s*Page\s*\d+\s*---', '', text)
        cleaned = cleaned.strip()
        # Remove common scanner artifact text and watermarks
        cleaned = re.sub(r'CamScanner', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'Scanned\s+(by|with)\s+\w+', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'MATHS\s+GUARDIOLA[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'DREAMSCOMETRUE[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'Study\s+in\s+India[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'O\s+and\s+A\s+level\s+students[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'ALL\s+MATERIAL\s+IS\s+FREE[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'CRAM,\s+PASS[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'FREE\s+O\s*&\s*A\s+LEVEL[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'We\s+are\s+a\s+Study[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'final\s+exams[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'Consultancy\s+assisting[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'[-\w]*Dollargrace[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'[-\w]*Perry[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'[+=]\d[\d\s\-]+', '', cleaned)  # Phone numbers like +91... or =263...
        cleaned = re.sub(r'\+\d[\d\s\-]+', '', cleaned)  # Phone numbers
        # Remove common ad/promo text
        cleaned = re.sub(r'50%\s+to\s+study[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'and\s+Diploma[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'FILES\s+ZIMSEC[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'scholarship[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'Degree[^\n]*', '', cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.strip()
        # Check if there's substantial text content (at least 500 chars after cleanup)
        return len(cleaned) > 500

    def process_paper(self, paper):
        """
        Process a paper to extract questions using AI.
        Automatically detects image-based PDFs and uses vision processing.

        Args:
            paper: Paper model instance with pdf_file

        Returns:
            dict: Processing result with extracted questions count
        """
        if not paper.pdf_file:
            return {
                'success': False,
                'error': 'No PDF file attached to this paper',
                'questions_extracted': 0
            }

        if not self.client:
            return {
                'success': False,
                'error': 'AI service not configured. Please set ANTHROPIC_API_KEY.',
                'questions_extracted': 0
            }

        # Build context about the paper
        syllabus = paper.syllabus
        context = {
            'board': syllabus.board.name,
            'subject': syllabus.subject.name,
            'level': syllabus.get_level_display(),
            'year': paper.year,
            'session': paper.get_session_display(),
            'paper_type': paper.get_paper_type_display(),
        }

        # Try text extraction first
        pdf_text = self.extract_text_from_pdf(paper.pdf_file)
        use_vision = not self._has_meaningful_text(pdf_text)

        if use_vision:
            logger.info(f"PDF appears to be image-based, using vision processing for paper {paper.id}")
            questions_data = self._extract_questions_with_vision(paper.pdf_file, context, max_pages=20)
        else:
            logger.info(f"PDF has text content, using text processing for paper {paper.id}")
            # Get marking scheme text if available
            marking_scheme_text = None
            if hasattr(paper, 'marking_scheme_file') and paper.marking_scheme_file:
                marking_scheme_text = self.extract_text_from_pdf(paper.marking_scheme_file)
            questions_data = self._extract_questions_with_ai(pdf_text, context, marking_scheme_text)

        if not questions_data:
            return {
                'success': False,
                'error': 'AI failed to extract questions from the paper. The PDF may be corrupted or unreadable.',
                'questions_extracted': 0
            }

        # Refresh DB connection - it may have timed out during long API calls
        from django.db import close_old_connections
        close_old_connections()

        # Re-fetch the paper to ensure we have a fresh DB connection
        from apps.exams.models import Paper as PaperModel
        paper = PaperModel.objects.get(id=paper.id)

        # Create Question objects
        questions_created = self._create_questions(paper, questions_data)

        # Update paper with extracted info - handle None marks
        paper.total_marks = sum(q.get('marks') or 0 for q in questions_data)
        paper.save(update_fields=['total_marks', 'updated_at'])

        return {
            'success': True,
            'questions_extracted': questions_created,
            'total_marks': paper.total_marks
        }

    def _extract_questions_with_vision(self, pdf_file, context, max_pages=20, dpi=150):
        """
        Use Claude's vision capability to extract questions from image-based PDFs.

        Args:
            pdf_file: Django file field
            context: Dict with paper metadata

        Returns:
            list: List of question dictionaries
        """
        # Convert PDF pages to images
        result = self.convert_pdf_to_images(pdf_file, max_pages=max_pages, dpi=dpi)

        if not result:
            logger.error("Failed to convert PDF to images")
            return None

        images, img_format = result
        media_type = f"image/{img_format}"

        # Build the message content with images
        content = []

        # Add context text
        content.append({
            "type": "text",
            "text": f"""Extract all examination questions from the following exam paper images.

**Paper Details:**
- Board: {context['board']}
- Subject: {context['subject']}
- Level: {context['level']}
- Year: {context['year']}
- Session: {context['session']}
- Paper Type: {context['paper_type']}

**Instructions:**
1. Carefully read each page image
2. Extract each question with its FULL text exactly as shown
3. Identify the question type (mcq, short_answer, long_answer, structured, essay)
4. Extract marks for each question (usually shown in brackets like [3] or (3 marks))
5. For MCQs, extract all options (A, B, C, D, etc.)
6. Identify sub-questions (e.g., 1a, 1b, 1c) as separate entries
7. Describe any diagrams, graphs, tables, or figures in detail
8. Include chemical equations, formulas, and scientific notation accurately

**LaTeX Formatting (CRITICAL):**
- Wrap ALL math expressions in LaTeX: inline $...$ or display $$...$$
- Chemical formulas and equations: $\\ce{{H2O}}$, $\\ce{{2H2 + O2 -> 2H2O}}$, $\\ce{{CaCO3}}$
- Units with numbers: $25 \\text{{ m/s}}$, $100 \\text{{ kg}}$, $\\text{{cm}}^2$
- Fractions: $\\frac{{a}}{{b}}$, square roots: $\\sqrt{{x}}$, powers: $x^2$, $10^{{-3}}$
- Greek letters: $\\alpha$, $\\theta$, $\\pi$, $\\Delta$
- Subscripts/superscripts: $H_2O$, $x^2$, $CO_2$
- MCQ options containing math or formulas MUST also use LaTeX
- Do NOT wrap plain English text in LaTeX — only math, formulas, units, and scientific notation

Here are the exam paper pages:"""
        })

        # Add each page image
        for i, img_base64 in enumerate(images):
            content.append({
                "type": "text",
                "text": f"\n--- Page {i + 1} ---"
            })
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": img_base64
                }
            })

        # Add the JSON format request
        content.append({
            "type": "text",
            "text": """

**Return as JSON array:**
[
    {
        "question_number": "1" or "1a" or "1(i)",
        "question_text": "Full question text including any instructions",
        "question_type": "mcq|short_answer|long_answer|structured|essay",
        "marks": <number>,
        "source_page": <page number where this question appears (1-indexed)>,
        "source_position": "top|upper|middle|lower|bottom" (vertical position on page),
        "options": [
            {"key": "A", "text": "Option text"},
            ...
        ] or null for non-MCQ,
        "correct_answer": null,
        "marking_scheme": null,
        "topic_text": "Inferred topic/subject area",
        "difficulty": "easy|medium|hard",
        "has_diagram": true/false,
        "diagram_description": "Detailed description of any diagram, graph, table, or figure" or null
    },
    ...
]

IMPORTANT:
- Extract ALL questions from ALL pages
- Include the source_page number (1-indexed) for EACH question
- Include source_position: "top" (0-20%), "upper" (20-40%), "middle" (40-60%), "lower" (60-80%), "bottom" (80-100%)
- If a question spans multiple pages, use the page where it starts
- Return ONLY the JSON array, no other text"""
        })

        try:
            logger.info(f"Sending {len(images)} page images to Claude for vision processing")

            # Use streaming to avoid 10-minute timeout on long requests
            response_text = ""
            with self.client.messages.stream(
                model=self.MODEL,
                max_tokens=24000,  # Increased for longer papers
                messages=[{"role": "user", "content": content}],
                system="You are an expert at reading and extracting examination questions from scanned exam papers. You can accurately read handwritten and printed text, interpret diagrams, and understand scientific notation. Always return valid JSON. Ensure all strings are properly escaped."
            ) as stream:
                for text in stream.text_stream:
                    response_text += text

            logger.info(f"Received response from Claude, length: {len(response_text)}")

            # Extract JSON from response
            start = response_text.find('[')
            end = response_text.rfind(']') + 1

            if start != -1 and end > start:
                json_str = response_text[start:end]
                try:
                    questions = json.loads(json_str)
                    logger.info(f"Successfully extracted {len(questions)} questions using vision")
                    return questions
                except json.JSONDecodeError as e:
                    # Try to repair truncated JSON
                    logger.warning(f"JSON parse error: {e}, attempting repair")
                    # Find last complete object
                    last_complete = json_str.rfind('},')
                    if last_complete > 0:
                        repaired = json_str[:last_complete+1] + ']'
                        try:
                            questions = json.loads(repaired)
                            logger.info(f"Repaired JSON, extracted {len(questions)} questions")
                            return questions
                        except:
                            pass
                    # Try finding last complete object with }]
                    last_complete = json_str.rfind('}')
                    if last_complete > 0:
                        repaired = json_str[:last_complete+1] + ']'
                        try:
                            questions = json.loads(repaired)
                            logger.info(f"Repaired JSON (alt), extracted {len(questions)} questions")
                            return questions
                        except:
                            logger.error(f"Failed to repair JSON")
            else:
                logger.error("No JSON array found in response")
                logger.error(f"Response text: {response_text[:500]}")

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
        except Exception as e:
            if '413' in str(e):
                # Request too large - try progressively lower resolution / fewer pages
                if dpi > 72:
                    new_dpi = max(72, dpi - 50)
                    logger.warning(f"Request too large at {dpi} DPI, retrying at {new_dpi} DPI")
                    return self._extract_questions_with_vision(pdf_file, context, max_pages=max_pages, dpi=new_dpi)
                elif max_pages > 15:
                    logger.warning(f"Request too large even at {dpi} DPI, retrying with max_pages=15")
                    return self._extract_questions_with_vision(pdf_file, context, max_pages=15, dpi=dpi)
                else:
                    logger.error(f"Request too large even at {dpi} DPI with {max_pages} pages - cannot process")
            logger.error(f"Vision extraction failed: {e}")

        return None

    def _extract_questions_with_ai(self, pdf_text, context, marking_scheme_text=None):
        """
        Use AI to extract questions from PDF text.

        Args:
            pdf_text: Extracted text from PDF
            context: Dict with paper metadata
            marking_scheme_text: Optional marking scheme text

        Returns:
            list: List of question dictionaries
        """
        prompt_parts = [
            f"""Extract all examination questions from the following paper.

**Paper Details:**
- Board: {context['board']}
- Subject: {context['subject']}
- Level: {context['level']}
- Year: {context['year']}
- Session: {context['session']}
- Paper Type: {context['paper_type']}

**Instructions:**
1. Extract each question with its full text
2. Identify the question type (mcq, short_answer, long_answer, structured, essay)
3. Extract marks for each question (usually shown in brackets like [3] or (3 marks))
4. For MCQs, extract all options (A, B, C, D, etc.)
5. Identify sub-questions (e.g., 1a, 1b, 1c) as separate entries
6. Note any diagrams or figures mentioned (describe what they show)

**LaTeX Formatting (CRITICAL):**
- Wrap ALL math expressions in LaTeX: inline $...$ or display $$...$$
- Chemical formulas and equations: $\\ce{{H2O}}$, $\\ce{{2H2 + O2 -> 2H2O}}$, $\\ce{{CaCO3}}$
- Units with numbers: $25 \\text{{ m/s}}$, $100 \\text{{ kg}}$, $\\text{{cm}}^2$
- Fractions: $\\frac{{a}}{{b}}$, square roots: $\\sqrt{{x}}$, powers: $x^2$, $10^{{-3}}$
- Greek letters: $\\alpha$, $\\theta$, $\\pi$, $\\Delta$
- Subscripts/superscripts: $H_2O$, $x^2$, $CO_2$
- MCQ options containing math or formulas MUST also use LaTeX
- Do NOT wrap plain English text in LaTeX — only math, formulas, units, and scientific notation

**Paper Text:**
{pdf_text[:25000]}
""",
        ]

        if marking_scheme_text:
            prompt_parts.append(f"""

**Marking Scheme (for reference):**
{marking_scheme_text[:5000]}
""")

        prompt_parts.append("""

**Return as JSON array:**
[
    {
        "question_number": "1" or "1a" or "1(i)",
        "question_text": "Full question text",
        "question_type": "mcq|short_answer|long_answer|structured|essay",
        "marks": <number>,
        "source_page": <page number where this question appears (1-indexed)>,
        "source_position": "top|upper|middle|lower|bottom" (vertical position on page),
        "options": [
            {"key": "A", "text": "Option text"},
            ...
        ] or null for non-MCQ,
        "correct_answer": "A" or "Answer text" if known from marking scheme,
        "marking_scheme": "Key marking points" if available,
        "topic_text": "Inferred topic/subject area",
        "difficulty": "easy|medium|hard",
        "has_diagram": true/false,
        "diagram_description": "Description of any diagram" or null
    },
    ...
]

IMPORTANT:
- Extract ALL questions from ALL pages
- Include the source_page number (1-indexed) based on the "--- Page X ---" markers in the text
- Include source_position: "top" (0-20%), "upper" (20-40%), "middle" (40-60%), "lower" (60-80%), "bottom" (80-100%)
- If a question spans multiple pages, use the page where it starts
- Only return the JSON array, no other text.""")

        prompt = ''.join(prompt_parts)

        try:
            # Use streaming to avoid 10-minute timeout on long requests
            response_text = ""
            with self.client.messages.stream(
                model=self.MODEL,
                max_tokens=24000,
                messages=[{"role": "user", "content": prompt}],
                system="You are an expert at extracting and structuring examination questions. Always return valid JSON."
            ) as stream:
                for text in stream.text_stream:
                    response_text += text

            # Extract JSON from response
            start = response_text.find('[')
            end = response_text.rfind(']') + 1

            if start != -1 and end > start:
                json_str = response_text[start:end]
                try:
                    questions = json.loads(json_str)
                    return questions
                except json.JSONDecodeError as e:
                    logger.warning(f"JSON parse error in text extraction: {e}, attempting repair")
                    last_complete = json_str.rfind('},')
                    if last_complete > 0:
                        repaired = json_str[:last_complete+1] + ']'
                        try:
                            questions = json.loads(repaired)
                            logger.info(f"Repaired JSON, extracted {len(questions)} questions")
                            return questions
                        except json.JSONDecodeError:
                            pass
                    last_complete = json_str.rfind('}')
                    if last_complete > 0:
                        repaired = json_str[:last_complete+1] + ']'
                        try:
                            questions = json.loads(repaired)
                            logger.info(f"Repaired JSON (alt), extracted {len(questions)} questions")
                            return questions
                        except json.JSONDecodeError:
                            logger.error("Failed to repair JSON from text extraction")

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
        except Exception as e:
            logger.error(f"AI extraction failed: {e}")

        return None

    def _create_questions(self, paper, questions_data):
        """
        Create Question objects from extracted data.
        Deletes existing questions first to allow re-extraction.

        Args:
            paper: Paper model instance
            questions_data: List of question dictionaries

        Returns:
            int: Number of questions created
        """
        from apps.exams.models import Question

        # Delete existing questions for this paper (allows re-extraction)
        deleted_count = paper.questions.all().delete()[0]
        if deleted_count > 0:
            logger.info(f"Deleted {deleted_count} existing questions for paper {paper.id}")

        created_count = 0

        for i, q_data in enumerate(questions_data):
            try:
                # Determine question type
                q_type = q_data.get('question_type', 'short_answer')
                if q_type not in ['mcq', 'short_answer', 'long_answer', 'structured', 'essay']:
                    q_type = 'short_answer'

                # Create the question - handle None values from AI
                marks_val = q_data.get('marks')
                marks = int(marks_val) if marks_val is not None else 1

                # Handle source page and position
                source_page_val = q_data.get('source_page')
                source_page = int(source_page_val) if source_page_val is not None else None

                # Validate source_position
                source_position = q_data.get('source_position', '')
                valid_positions = ['top', 'upper', 'middle', 'lower', 'bottom']
                if source_position not in valid_positions:
                    source_position = ''

                # Truncate correct_answer to fit field (max 200 chars)
                correct_answer = q_data.get('correct_answer') or ''
                if len(correct_answer) > 200:
                    correct_answer = correct_answer[:200]

                # Truncate question_number to fit field (max 50 chars)
                question_number = (q_data.get('question_number') or str(i + 1))[:50]

                question = Question.objects.create(
                    paper=paper,
                    question_number=question_number,
                    question_text=q_data.get('question_text') or '',
                    question_type=q_type,
                    marks=marks,
                    options=q_data.get('options'),
                    correct_answer=correct_answer,
                    marking_scheme=q_data.get('marking_scheme') or '',
                    topic_text=q_data.get('topic_text') or '',
                    difficulty=q_data.get('difficulty') or 'medium',
                    order=i + 1,
                    # Source reference fields
                    source_page=source_page,
                    source_position=source_position,
                    has_diagram=bool(q_data.get('has_diagram', False)),
                    diagram_description=q_data.get('diagram_description') or '',
                )
                created_count += 1

            except Exception as e:
                logger.error(f"Failed to create question: {e}")
                continue

        return created_count


def process_paper_async(paper_id):
    """
    Process a paper asynchronously (can be called from a task queue).

    Args:
        paper_id: ID of the Paper to process
    """
    from apps.exams.models import Paper

    try:
        paper = Paper.objects.get(pk=paper_id)
        service = PaperProcessingService()
        result = service.process_paper(paper)

        # Update paper status based on result
        if result['success']:
            logger.info(f"Successfully processed paper {paper_id}: {result['questions_extracted']} questions extracted")
        else:
            logger.error(f"Failed to process paper {paper_id}: {result['error']}")

        return result

    except Paper.DoesNotExist:
        logger.error(f"Paper {paper_id} not found")
        return {'success': False, 'error': 'Paper not found'}

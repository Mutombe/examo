"""
Management command to split greenbook/compilation PDFs into individual papers.
Uses PyMuPDF to split pages and Claude to identify paper boundaries.
"""

import json
import os
import re
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from apps.exams.models import Paper, Syllabus, ExaminationBoard, Subject


def get_page_count(file_path):
    try:
        import fitz
        doc = fitz.open(str(file_path))
        count = len(doc)
        doc.close()
        return count
    except Exception:
        return 0


class Command(BaseCommand):
    help = 'Split greenbook/compilation PDFs into individual papers using AI'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file', type=str, required=True,
            help='Path to the greenbook PDF file'
        )
        parser.add_argument(
            '--subject', type=str, required=True,
            help='Subject name (must exist in DB)'
        )
        parser.add_argument(
            '--level', type=str, default='o_level',
            choices=['o_level', 'a_level'],
            help='Level (default: o_level)'
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Only detect boundaries, do not create papers'
        )
        parser.add_argument(
            '--manual-ranges', type=str, default=None,
            help='JSON string of manual page ranges, e.g. \'[{"start":1,"end":10,"year":2020,"session":"november","paper_type":"paper_1"},...]\''
        )
        parser.add_argument(
            '--sample-pages', type=int, default=5,
            help='Number of pages to sample for TOC detection (default: 5)'
        )
        parser.add_argument(
            '--force-vision', action='store_true',
            help='Force vision-based boundary detection even for text-based PDFs'
        )

    def handle(self, *args, **options):
        import fitz

        file_path = Path(options['file'])
        if not file_path.exists():
            self.stderr.write(self.style.ERROR(f'File not found: {file_path}'))
            return

        subject_name = options['subject']
        level = options['level']
        dry_run = options['dry_run']

        # Verify subject exists
        subject = Subject.objects.filter(name=subject_name).first()
        if not subject:
            self.stderr.write(self.style.ERROR(f'Subject not found: {subject_name}'))
            self.stderr.write('Available subjects:')
            for s in Subject.objects.all():
                self.stderr.write(f'  - {s.name}')
            return

        board = ExaminationBoard.objects.filter(short_name='ZIMSEC').first()
        if not board:
            self.stderr.write(self.style.ERROR('ZIMSEC board not found'))
            return

        syllabus = Syllabus.objects.filter(
            board=board, subject=subject, level=level
        ).first()
        if not syllabus:
            self.stderr.write(self.style.ERROR(
                f'Syllabus not found for {subject_name} ({level}). Create it first.'
            ))
            return

        doc = fitz.open(str(file_path))
        total_pages = len(doc)
        self.stdout.write(self.style.SUCCESS(
            f'Opened: {file_path.name} ({total_pages} pages)'
        ))

        # Step 1: Get paper boundaries
        if options['manual_ranges']:
            boundaries = json.loads(options['manual_ranges'])
            self.stdout.write(f'Using {len(boundaries)} manual ranges')
        else:
            boundaries = self._detect_boundaries(doc, file_path, subject_name, level, options['sample_pages'], options.get('force_vision', False))

        if not boundaries:
            self.stderr.write(self.style.ERROR('No paper boundaries detected'))
            doc.close()
            return

        self.stdout.write(self.style.SUCCESS(
            f'\nDetected {len(boundaries)} papers:'
        ))
        for i, b in enumerate(boundaries):
            self.stdout.write(
                f'  {i+1}. Pages {b["start"]}-{b["end"]}: '
                f'{subject_name} {b.get("year","?")} {b.get("session","?")} '
                f'{b.get("paper_type","?")} '
                f'({b["end"] - b["start"] + 1}p)'
            )

        if dry_run:
            doc.close()
            self.stdout.write(self.style.WARNING('\n--- DRY RUN: No papers created ---'))
            return

        # Step 2: Split and create papers
        self.stdout.write(self.style.SUCCESS('\n=== Splitting and Creating Papers ==='))
        created = 0

        for boundary in boundaries:
            year = boundary.get('year')
            session = boundary.get('session', 'november')
            paper_type = boundary.get('paper_type', 'paper_1')
            start_page = boundary['start'] - 1  # fitz uses 0-indexed
            end_page = boundary['end']  # exclusive end for select()

            if not year:
                self.stdout.write(self.style.WARNING(
                    f'  Skipping: no year for pages {boundary["start"]}-{boundary["end"]}'
                ))
                continue

            # Skip marking schemes - they're not question papers
            valid_types = ['paper_1', 'paper_2', 'paper_3', 'paper_4', 'paper_5', 'paper_6', 'practical', 'theory']
            if paper_type not in valid_types:
                self.stdout.write(self.style.WARNING(
                    f'  Skipping non-paper: {paper_type} (pages {boundary["start"]}-{boundary["end"]})'
                ))
                continue

            # Check if paper already exists
            existing = Paper.objects.filter(
                syllabus=syllabus,
                year=year,
                session=session,
                paper_type=paper_type,
            ).first()
            if existing:
                self.stdout.write(
                    f'  Already exists: {existing.title}'
                )
                continue

            # Split pages
            split_doc = fitz.open()
            split_doc.insert_pdf(doc, from_page=start_page, to_page=end_page - 1)

            # Save to temp file then read
            tmp_path = tempfile.mktemp(suffix='.pdf')
            split_doc.save(tmp_path)
            split_doc.close()

            with open(tmp_path, 'rb') as f:
                file_content = f.read()
            os.unlink(tmp_path)

            title = f'{subject_name} Paper {paper_type.split("_")[1]} ({year} {session.title()})'

            paper = Paper.objects.create(
                syllabus=syllabus,
                title=title,
                paper_type=paper_type,
                year=year,
                session=session,
                status='approved',
                is_active=True,
            )
            paper.pdf_file.save(
                f'{subject_name.lower().replace(" ", "-")}-{paper_type}-{year}-{session}.pdf',
                ContentFile(file_content)
            )
            created += 1
            page_count = end_page - start_page
            self.stdout.write(self.style.SUCCESS(
                f'  Created: {title} ({page_count}p)'
            ))

        doc.close()
        self.stdout.write(self.style.SUCCESS(
            f'\n=== Done: {created} papers created ===\n'
            f'Run `python manage.py process_papers --unprocessed` to extract questions.'
        ))

    def _has_meaningful_text(self, doc, sample_pages=5):
        """Check if PDF has meaningful extractable text."""
        watermark_patterns = [
            r'CamScanner', r'Scanned\s+(by|with)\s+\w+',
            r'MATHS\s+GUARDIOLA', r'DREAMSCOMETRUE',
        ]
        total_text = ''
        for i in range(min(sample_pages, len(doc))):
            total_text += doc[i].get_text()
        cleaned = total_text
        for pat in watermark_patterns:
            cleaned = re.sub(pat, '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\+\d[\d\s\-]+', '', cleaned)
        cleaned = cleaned.strip()
        return len(cleaned) > 200

    def _detect_boundaries(self, doc, file_path, subject_name, level, sample_pages, force_vision=False):
        """Use Claude to detect paper boundaries. Uses vision for scanned PDFs."""
        import base64
        import fitz

        api_key = getattr(settings, 'ANTHROPIC_API_KEY', None)
        if not api_key:
            self.stderr.write(self.style.ERROR('ANTHROPIC_API_KEY not set'))
            return None

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
        except ImportError:
            self.stderr.write(self.style.ERROR('anthropic package not installed'))
            return None

        total_pages = len(doc)
        use_vision = force_vision or not self._has_meaningful_text(doc)

        if use_vision:
            return self._detect_boundaries_vision(doc, client, subject_name, level, total_pages)
        else:
            return self._detect_boundaries_text(doc, client, subject_name, level, total_pages, sample_pages)

    def _detect_boundaries_vision(self, doc, client, subject_name, level, total_pages):
        """Detect boundaries using vision - for scanned PDFs."""
        import base64
        import fitz

        self.stdout.write('PDF is scanned/image-based, using vision for boundary detection...')

        # Sample pages strategically: first 2, then every ~5-8 pages, last 2
        # We want to see every potential paper start page
        sample_indices = set()
        # First 2 pages
        for i in range(min(2, total_pages)):
            sample_indices.add(i)
        # Sample densely - every 5 pages for small docs, every 8 for larger
        step = 5 if total_pages <= 100 else 8
        for i in range(0, total_pages, step):
            sample_indices.add(i)
        # Last 2 pages
        for i in range(max(0, total_pages - 2), total_pages):
            sample_indices.add(i)
        sample_indices = sorted(sample_indices)

        # Cap at 30 images to stay within API limits
        if len(sample_indices) > 30:
            step = len(sample_indices) // 30
            sample_indices = [sample_indices[i] for i in range(0, len(sample_indices), step)][:30]

        self.stdout.write(f'Sampling {len(sample_indices)} pages for boundary detection...')

        content = []
        content.append({
            "type": "text",
            "text": f"""Analyze these sampled pages from a greenbook/compilation PDF and identify the boundaries of each individual exam paper.

**Context:**
- Subject: {subject_name}
- Level: {'O Level' if level == 'o_level' else 'A Level'}
- Total pages in PDF: {total_pages}
- This is a compilation of ZIMSEC (Zimbabwe) past exam papers
- I'm showing you sampled pages - note the page numbers carefully

**Look for:**
- Cover pages / title pages that say "PAPER 1", "PAPER 2", etc.
- Pages showing exam header info: subject code, year, session, time allowed
- "Question 1" or "Section A" indicators that mark paper starts
- Marking scheme sections (usually at the end of each paper or all at the end)

**For each paper found, determine:**
1. Start page and end page (1-indexed, inclusive)
2. Year (from the exam header)
3. Session: "june" or "november"
4. Paper type: "paper_1", "paper_2", "paper_3", etc.

Here are the sampled pages:"""
        })

        for idx in sample_indices:
            page = doc[idx]
            mat = fitz.Matrix(100/72, 100/72)  # ~100 DPI for reasonable quality
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("jpeg", jpg_quality=50)
            img_base64 = base64.standard_b64encode(img_bytes).decode('utf-8')
            content.append({"type": "text", "text": f"\n--- Page {idx + 1} of {total_pages} ---"})
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": img_base64}
            })

        content.append({
            "type": "text",
            "text": f"""

**Return as JSON array:**
[
    {{
        "start": <start page 1-indexed>,
        "end": <end page 1-indexed inclusive>,
        "year": <year as integer>,
        "session": "june" or "november",
        "paper_type": "paper_1" or "paper_2" etc.,
        "notes": "optional description"
    }},
    ...
]

IMPORTANT:
- Pages should not overlap between papers
- Cover all {total_pages} pages (account for gaps between sampled pages)
- Marking schemes may be separate entries or part of papers
- If marking schemes are bundled at the end, note them separately
- Return ONLY the JSON array"""
        })

        self.stdout.write('Sending images to Claude for boundary detection...')

        try:
            response_text = ""
            with client.messages.stream(
                model='claude-sonnet-4-20250514',
                max_tokens=8000,
                messages=[{'role': 'user', 'content': content}],
                system='You are an expert at analyzing exam paper compilations. Return valid JSON only.'
            ) as stream:
                for text in stream.text_stream:
                    response_text += text

            return self._parse_boundaries_response(response_text)

        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Vision boundary detection failed: {e}'))
            return None

    def _detect_boundaries_text(self, doc, client, subject_name, level, total_pages, sample_pages):
        """Detect boundaries using text extraction - for text-based PDFs."""
        # Extract text from first N pages and sample pages throughout
        text_parts = []

        # First few pages (likely TOC)
        for i in range(min(sample_pages, total_pages)):
            page = doc[i]
            text_parts.append(f'\n--- Page {i+1} ---\n{page.get_text()}')

        # Sample every ~20 pages for paper start indicators
        step = max(total_pages // 15, 10)
        for i in range(sample_pages, total_pages, step):
            page = doc[i]
            text = page.get_text()
            if any(kw in text.lower() for kw in [
                'paper', 'section', 'question 1', 'time allowed',
                'instructions', 'answer all', 'november', 'june',
                'examination', 'candidates'
            ]):
                text_parts.append(f'\n--- Page {i+1} ---\n{text}')

        # Also check last few pages
        for i in range(max(total_pages - 3, 0), total_pages):
            if i >= sample_pages:
                page = doc[i]
                text_parts.append(f'\n--- Page {i+1} ---\n{page.get_text()}')

        extracted_text = ''.join(text_parts)[:20000]

        prompt = f"""Analyze this greenbook/compilation PDF and identify the boundaries of each individual exam paper.

**Context:**
- Subject: {subject_name}
- Level: {'O Level' if level == 'o_level' else 'A Level'}
- Total pages: {total_pages}
- This is a compilation of past exam papers from ZIMSEC (Zimbabwe)

**Extracted text from sampled pages:**
{extracted_text}

**Task:**
Identify each individual exam paper in this compilation. For each paper, determine:
1. Start page (1-indexed)
2. End page (1-indexed, inclusive)
3. Year
4. Session (june or november)
5. Paper type (paper_1, paper_2, paper_3, etc.)

**Return as JSON array:**
[
    {{
        "start": <start page>,
        "end": <end page>,
        "year": <year as integer>,
        "session": "june" or "november",
        "paper_type": "paper_1" or "paper_2" etc.,
        "notes": "optional description"
    }},
    ...
]

IMPORTANT:
- Pages should not overlap between papers
- Cover all pages if possible (some may be blank/filler)
- If you can't determine exact boundaries, make your best estimate
- Return ONLY the JSON array"""

        self.stdout.write('Sending to Claude for boundary detection...')

        try:
            response = client.messages.create(
                model='claude-sonnet-4-20250514',
                max_tokens=8000,
                messages=[{'role': 'user', 'content': prompt}],
                system='You are an expert at analyzing exam paper compilations. Return valid JSON only.'
            )

            response_text = response.content[0].text
            return self._parse_boundaries_response(response_text)

        except Exception as e:
            self.stderr.write(self.style.ERROR(f'AI detection failed: {e}'))
            return None

    def _parse_boundaries_response(self, response_text):
        """Parse JSON boundaries from AI response."""
        start = response_text.find('[')
        end = response_text.rfind(']') + 1

        if start != -1 and end > start:
            try:
                boundaries = json.loads(response_text[start:end])
                return boundaries
            except json.JSONDecodeError as e:
                self.stderr.write(self.style.ERROR(f'JSON parse error: {e}'))
                self.stderr.write(response_text[:500])
                return None
        else:
            self.stderr.write(self.style.ERROR('No JSON found in response'))
            self.stderr.write(response_text[:500])
            return None

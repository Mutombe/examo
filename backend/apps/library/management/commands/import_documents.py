"""
Management command to scan, classify, and import documents from the question papers folder.
Classifies PDFs as question papers, marking schemes, or library resources.
Uploads to DigitalOcean Spaces and creates database records.
"""

import os
import re
from pathlib import Path
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from django.utils.text import slugify

from apps.exams.models import Paper, Syllabus, ExaminationBoard, Subject
from apps.library.models import Resource, ResourceCategory


# Pattern matchers for document classification
QP_PATTERNS = [
    r'qp\s',           # "qp " in filename
    r'paper\s*\d',      # "paper 2", "paper 3"
    r'J\d{4}\s.*paper', # "J2024 chemistry paper"
]

MS_PATTERNS = [
    r'\bms\b',          # "ms" as standalone word
    r'mark\s*scheme',
    r'marking\s*scheme',
]

RESOURCE_PATTERNS = [
    r'booklet',
    r'guide',
    r'notes',
    r'syllabus',
    r'formula',
    r'data\s*book',
    r'revision',
]


def classify_document(filename):
    """
    Classify a document by its filename.
    Returns: 'question_paper', 'marking_scheme', or 'resource'
    """
    name_lower = filename.lower()

    # Check for marking scheme first (ms takes priority)
    for pattern in MS_PATTERNS:
        if re.search(pattern, name_lower):
            return 'marking_scheme'

    # Check for question paper
    for pattern in QP_PATTERNS:
        if re.search(pattern, name_lower):
            # But not if it also matches resource patterns
            is_resource = False
            for rp in RESOURCE_PATTERNS:
                if re.search(rp, name_lower):
                    is_resource = True
                    break
            if not is_resource:
                return 'question_paper'

    # Check for resources
    for pattern in RESOURCE_PATTERNS:
        if re.search(pattern, name_lower):
            return 'resource'

    # Default: treat as question paper if it has year/paper info
    if re.search(r'\d{4}', name_lower) and re.search(r'paper', name_lower):
        return 'question_paper'

    # Unknown - treat as resource
    return 'resource'


def parse_paper_info(filename):
    """
    Extract year, session, paper number, subject from filename.
    Returns dict with parsed info.
    """
    name_lower = filename.lower()
    info = {
        'year': None,
        'session': 'november',
        'paper_type': 'paper_1',
        'subject': 'Chemistry',
        'board': 'ZIMSEC',
        'level': 'a_level',
    }

    # Extract year
    year_match = re.search(r'(20\d{2})', filename)
    if not year_match:
        # Try J2024 format
        year_match = re.search(r'J(\d{4})', filename)
    if year_match:
        info['year'] = int(year_match.group(1))

    # Extract session
    if 'june' in name_lower or name_lower.startswith('j'):
        info['session'] = 'june'
    elif 'march' in name_lower:
        info['session'] = 'march'

    # Extract paper number
    paper_match = re.search(r'paper\s*(\d)', name_lower)
    if paper_match:
        num = paper_match.group(1)
        info['paper_type'] = f'paper_{num}'

    # Check level
    if 'o level' in name_lower or 'o-level' in name_lower:
        info['level'] = 'o_level'
    elif 'igcse' in name_lower:
        info['level'] = 'igcse'

    return info


def get_page_count(file_path):
    """Get page count of a PDF."""
    try:
        import fitz
        doc = fitz.open(file_path)
        count = len(doc)
        doc.close()
        return count
    except Exception:
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(file_path)
            return len(reader.pages)
        except Exception:
            return 0


class Command(BaseCommand):
    help = 'Import documents from question papers folder, classify and upload them'

    def add_arguments(self, parser):
        parser.add_argument(
            '--folder',
            type=str,
            default=None,
            help='Path to documents folder (defaults to project root "question papers")'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Only classify, do not upload'
        )

    def handle(self, *args, **options):
        # Find the folder
        folder = options['folder']
        if not folder:
            # Default: project root / question papers
            base = Path(__file__).resolve().parent.parent.parent.parent.parent
            folder = base / 'question papers'

        folder = Path(folder)
        if not folder.exists():
            self.stderr.write(self.style.ERROR(f'Folder not found: {folder}'))
            return

        dry_run = options['dry_run']

        self.stdout.write(self.style.SUCCESS(f'Scanning: {folder}'))

        # Get all PDFs
        pdfs = list(folder.glob('*.pdf'))
        self.stdout.write(f'Found {len(pdfs)} PDF files\n')

        # Classify
        question_papers = []
        marking_schemes = []
        resources = []

        for pdf_path in pdfs:
            doc_type = classify_document(pdf_path.name)
            if doc_type == 'question_paper':
                question_papers.append(pdf_path)
            elif doc_type == 'marking_scheme':
                marking_schemes.append(pdf_path)
            else:
                resources.append(pdf_path)

        self.stdout.write(self.style.SUCCESS(f'\n=== Classification ==='))
        self.stdout.write(f'Question Papers: {len(question_papers)}')
        for p in question_papers:
            self.stdout.write(f'  [QP] {p.name}')

        self.stdout.write(f'\nMarking Schemes: {len(marking_schemes)}')
        for p in marking_schemes:
            self.stdout.write(f'  [MS] {p.name}')

        self.stdout.write(f'\nResources/Booklets: {len(resources)}')
        for p in resources:
            self.stdout.write(f'  [RES] {p.name}')

        if dry_run:
            self.stdout.write(self.style.WARNING('\n--- DRY RUN: No changes made ---'))
            return

        # Ensure board and subject exist
        board, _ = ExaminationBoard.objects.get_or_create(
            short_name='ZIMSEC',
            defaults={
                'name': 'Zimbabwe School Examinations Council',
                'country': 'Zimbabwe',
            }
        )

        subject, _ = Subject.objects.get_or_create(
            name='Chemistry',
            defaults={
                'code': 'CHEM',
                'icon': 'flask',
                'color': '#8B5CF6',
            }
        )

        # Ensure syllabus exists
        syllabus, _ = Syllabus.objects.get_or_create(
            board=board,
            subject=subject,
            level='a_level',
            defaults={'syllabus_code': '6035'}
        )

        # Create resource category for booklets
        booklet_cat, _ = ResourceCategory.objects.get_or_create(
            slug='chemistry-booklets',
            defaults={
                'name': 'Chemistry Booklets',
                'description': 'Option booklets and reference materials for A-Level Chemistry',
                'icon': 'book-open',
                'color': '#8B5CF6',
            }
        )

        # Import Question Papers
        self.stdout.write(self.style.SUCCESS('\n=== Importing Question Papers ==='))
        for pdf_path in question_papers:
            info = parse_paper_info(pdf_path.name)

            if not info['year']:
                self.stdout.write(self.style.WARNING(f'  Skipping (no year): {pdf_path.name}'))
                continue

            # Clean title
            title = f"{info['subject']} Paper {info['paper_type'].split('_')[1]} ({info['year']} {info['session'].title()})"

            # Check if already exists
            existing = Paper.objects.filter(
                syllabus=syllabus,
                year=info['year'],
                session=info['session'],
                paper_type=info['paper_type'],
            ).first()

            if existing:
                self.stdout.write(f'  Already exists: {title}')
                continue

            # Read file
            with open(pdf_path, 'rb') as f:
                file_content = f.read()

            page_count = get_page_count(pdf_path)

            paper = Paper.objects.create(
                syllabus=syllabus,
                title=title,
                paper_type=info['paper_type'],
                year=info['year'],
                session=info['session'],
                status='approved',
                is_active=True,
            )
            paper.pdf_file.save(pdf_path.name, ContentFile(file_content))
            self.stdout.write(self.style.SUCCESS(f'  Imported: {title} ({page_count} pages)'))

        # Try to match marking schemes to papers
        self.stdout.write(self.style.SUCCESS('\n=== Matching Marking Schemes ==='))
        for pdf_path in marking_schemes:
            info = parse_paper_info(pdf_path.name)

            if not info['year']:
                self.stdout.write(self.style.WARNING(f'  Skipping (no year): {pdf_path.name}'))
                continue

            # Find matching paper
            matching_paper = Paper.objects.filter(
                syllabus=syllabus,
                year=info['year'],
                session=info['session'],
                paper_type=info['paper_type'],
            ).first()

            if matching_paper and not matching_paper.marking_scheme_file:
                with open(pdf_path, 'rb') as f:
                    file_content = f.read()
                matching_paper.marking_scheme_file.save(pdf_path.name, ContentFile(file_content))
                self.stdout.write(self.style.SUCCESS(f'  Matched MS to: {matching_paper.title}'))
            elif matching_paper:
                self.stdout.write(f'  Paper already has MS: {matching_paper.title}')
            else:
                self.stdout.write(self.style.WARNING(f'  No matching paper for: {pdf_path.name}'))

        # Import Resources
        self.stdout.write(self.style.SUCCESS('\n=== Importing Resources ==='))
        for pdf_path in resources:
            # Clean up title from filename
            name = pdf_path.stem
            # Remove hash suffixes like -me3jj, -wel5r
            name = re.sub(r'-[a-zA-Z0-9]{4,6}(\s*\(\d+\))?$', '', name)
            name = name.strip()

            if not name or name == '-':
                self.stdout.write(self.style.WARNING(f'  Skipping (no name): {pdf_path.name}'))
                continue

            slug = slugify(name)
            if not slug:
                slug = slugify(pdf_path.stem)

            # Check if exists
            if Resource.objects.filter(slug=slug).exists():
                self.stdout.write(f'  Already exists: {name}')
                continue

            page_count = get_page_count(pdf_path)
            file_size = pdf_path.stat().st_size

            with open(pdf_path, 'rb') as f:
                file_content = f.read()

            # Determine type from name
            resource_type = 'booklet'
            if 'guide' in name.lower():
                resource_type = 'study_guide'
            elif 'note' in name.lower():
                resource_type = 'notes'
            elif 'syllabus' in name.lower():
                resource_type = 'syllabus'
            elif 'formula' in name.lower():
                resource_type = 'formula_sheet'

            resource = Resource.objects.create(
                title=name,
                slug=slug,
                description=f'{name} - A-Level Chemistry reference material',
                resource_type=resource_type,
                category=booklet_cat,
                subject=subject,
                level='a_level',
                page_count=page_count,
                file_size_bytes=file_size,
                cover_color='#8B5CF6',
                tags=['chemistry', 'a-level', resource_type],
                is_featured=True,
                is_active=True,
            )
            resource.file.save(pdf_path.name, ContentFile(file_content))
            self.stdout.write(self.style.SUCCESS(f'  Imported resource: {name} ({page_count} pages, {resource.file_size_display})'))

        self.stdout.write(self.style.SUCCESS('\n=== Import Complete ==='))

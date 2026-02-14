"""
Management command to import question papers from the QPs/ folder.
Creates new subjects/syllabi as needed, imports individual papers,
attaches marking schemes, and sends compilations to Library.
"""

import os
import re
from pathlib import Path
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from django.utils.text import slugify

from apps.exams.models import Paper, Syllabus, ExaminationBoard, Subject
from apps.library.models import Resource, ResourceCategory


def get_page_count(file_path):
    """Get page count of a PDF."""
    try:
        import fitz
        doc = fitz.open(str(file_path))
        count = len(doc)
        doc.close()
        return count
    except Exception:
        return 0


# ──────────────────────────────────────────────────────────
# Mapping of each QP filename → metadata
# ──────────────────────────────────────────────────────────

# Filenames that are duplicates — skip entirely
DUPLICATES = {
    '434252227-40062-heritage-Studies-pdf (1).pdf',
    '434252227-40062-heritage-Studies-pdf (2).pdf',
    '721450730-Green-book-2020-2023 (1).pdf',
    '771600190-Geography-Paper-2-June-2024 (1).pdf',
    '882956935-Zimsec-Maths-June-2025-p1-maths (1).pdf',
    '891762832-June-2025-Combined-Science-p2 (1).pdf',
}

# Greenbooks/compilations — Phase 4 (skip for now, just report)
GREENBOOKS = {
    '459793984-mathematics-GREEN-BOOK-1-pdf.pdf',
    '676214763-Emerald-Key-Mathematics.pdf',
    '710067538-Zimsec-Chemistry-Green-Book.pdf',
    '702744034-Emerald-Key-Biology-Greenbook.pdf',
    '732399572-English-Green-Book.pdf',
    '643056414-GEOGRAPHY-EMERALD-KEY-2018-19-pdf.pdf',
    '721450730-Green-book-2020-2023.pdf',
    '829480690-New-Trends-in-Combined-Science-3-Sample.pdf',
    '843420097-COMBINED-SCIENCE-NOVEMBER-2024-PAPER-1-2-3.pdf',
    '755880931-ZIMSEC-O-Level-Maths-Papers-2023-041532.pdf',
}

# Mapping: filename → dict of import metadata
# type: 'paper', 'marking_scheme', 'library', 'specimen'
PAPER_MAP = {
    # ── Heritage Studies ──
    '434251476-40061-Heritage-Multiple-Choice.pdf': {
        'type': 'specimen', 'subject': 'Heritage Studies', 'level': 'o_level',
        'title': 'Heritage Studies MCQ Specimen Paper',
    },
    '434252227-40062-heritage-Studies-pdf.pdf': {
        'type': 'specimen', 'subject': 'Heritage Studies', 'level': 'o_level',
        'title': 'Heritage Studies Paper 2 Specimen',
    },
    '588693870-HERITAGE-ESSAY-QUESTIONS-PAPER-2.pdf': {
        'type': 'library', 'subject': 'Heritage Studies', 'level': 'o_level',
        'title': 'Heritage Studies Essay Questions Collection',
        'resource_type': 'revision',
    },
    '747235934-Heritage-Studies-Pii-2020.pdf': {
        'type': 'paper', 'subject': 'Heritage Studies', 'level': 'o_level',
        'year': 2020, 'session': 'november', 'paper_type': 'paper_2',
    },
    '756427892-HERITAGE-STUDIES-p2-2019-240730-173727.pdf': {
        'type': 'paper', 'subject': 'Heritage Studies', 'level': 'o_level',
        'year': 2019, 'session': 'november', 'paper_type': 'paper_2',
    },
    '841451584-HERITAGE-FORM-4.pdf': {
        'type': 'library', 'subject': 'Heritage Studies', 'level': 'o_level',
        'title': 'Heritage Studies Form 4 Notes',
        'resource_type': 'notes',
    },
    '666521900-o-levels-heritage-studies-exemplar.pdf': {
        'type': 'specimen', 'subject': 'Heritage Studies', 'level': 'o_level',
        'title': 'Heritage Studies Exemplar Paper',
    },

    # ── Combined Science ──
    '518090569-Zimsec-Nov-2020-Combined-Science-Paper-2.pdf': {
        'type': 'paper', 'subject': 'Combined Science', 'level': 'o_level',
        'year': 2020, 'session': 'november', 'paper_type': 'paper_2',
    },
    '518090737-Zimsec-Nov-2020-Combined-Science-Paper-1.pdf': {
        'type': 'paper', 'subject': 'Combined Science', 'level': 'o_level',
        'year': 2020, 'session': 'november', 'paper_type': 'paper_1',
    },
    '652909764-O-levels-Combined-Science-2018-3.pdf': {
        'type': 'paper', 'subject': 'Combined Science', 'level': 'o_level',
        'year': 2018, 'session': 'november', 'paper_type': 'paper_3',
    },
    '748646836-COMBINED-SCIENCE-JUNE-2024-PAPER-2.pdf': {
        'type': 'paper', 'subject': 'Combined Science', 'level': 'o_level',
        'year': 2024, 'session': 'june', 'paper_type': 'paper_2',
    },
    '772059167-Combined-Science-November-2023-Session-P1.pdf': {
        'type': 'paper', 'subject': 'Combined Science', 'level': 'o_level',
        'year': 2023, 'session': 'november', 'paper_type': 'paper_1',
    },
    '891762832-June-2025-Combined-Science-p2.pdf': {
        'type': 'paper', 'subject': 'Combined Science', 'level': 'o_level',
        'year': 2025, 'session': 'june', 'paper_type': 'paper_2',
    },
    '511533045-Zimsec-Nov-2019-Combined-Science-Marking-Scheme-Paper-2.pdf': {
        'type': 'marking_scheme', 'subject': 'Combined Science', 'level': 'o_level',
        'year': 2019, 'session': 'november', 'paper_type': 'paper_2',
    },
    '878938728-Zimsec-Nov-2024-Science-Paper-1-Marking-Scheme.pdf': {
        'type': 'marking_scheme', 'subject': 'Combined Science', 'level': 'o_level',
        'year': 2024, 'session': 'november', 'paper_type': 'paper_1',
    },
    '745609582-ZIMSEC-O-level-Combined-Science-Past-Exam-Paper-1-Set-2.pdf': {
        'type': 'specimen', 'subject': 'Combined Science', 'level': 'o_level',
        'title': 'Combined Science Paper 1 Practice Set 2',
    },
    '749257580-ZIMSEC-O-level-Combined-Science-Past-Exam-Paper-2-Set-2.pdf': {
        'type': 'specimen', 'subject': 'Combined Science', 'level': 'o_level',
        'title': 'Combined Science Paper 2 Practice Set 2',
    },
    '822295937-ZIMSEC-O-level-Combined-Science-Past-Exam-Paper-1-Set-1.pdf': {
        'type': 'specimen', 'subject': 'Combined Science', 'level': 'o_level',
        'title': 'Combined Science Paper 1 Practice Set 1',
    },

    # ── Combined Science MS compilation → Library ──
    '789366667-COMBINED-SCIENCE-PAPER-2-MARKING-SCHEMES-NOV-2018-JUNE-2024-MATHS-GUARDIOLA-DOCUMENTS-447852954215.pdf': {
        'type': 'library', 'subject': 'Combined Science', 'level': 'o_level',
        'title': 'Combined Science Paper 2 Marking Schemes (2018-2024)',
        'resource_type': 'revision',
    },

    # ── Mathematics O-Level ──
    '521419036-Zimsec-June-2020-Maths-O-level-Paper-1.pdf': {
        'type': 'paper', 'subject': 'Mathematics', 'level': 'o_level',
        'year': 2020, 'session': 'june', 'paper_type': 'paper_1',
    },
    '627679949-O-Level-Maths-P1-Nov-2021.pdf': {
        'type': 'paper', 'subject': 'Mathematics', 'level': 'o_level',
        'year': 2021, 'session': 'november', 'paper_type': 'paper_1',
    },
    '830351145-Maths-4004-November-2024-Paper1.pdf': {
        'type': 'paper', 'subject': 'Mathematics', 'level': 'o_level',
        'year': 2024, 'session': 'november', 'paper_type': 'paper_1',
    },
    '882956935-Zimsec-Maths-June-2025-p1-maths.pdf': {
        'type': 'paper', 'subject': 'Mathematics', 'level': 'o_level',
        'year': 2025, 'session': 'june', 'paper_type': 'paper_1',
    },
    '937393981-O-Lvl-Maths-P2-Nov-2025.pdf': {
        'type': 'paper', 'subject': 'Mathematics', 'level': 'o_level',
        'year': 2025, 'session': 'november', 'paper_type': 'paper_2',
    },
    '960278977-Maths-P2-Nov-2025-2.pdf': {
        'type': 'paper', 'subject': 'Mathematics', 'level': 'o_level',
        'year': 2025, 'session': 'november', 'paper_type': 'paper_2',
        'skip_if_exists': True,  # Likely duplicate of above
    },
    '768315212-Maths-O-level-Nov-2023-Paper-1-zBpx8-1.pdf': {
        'type': 'paper', 'subject': 'Mathematics', 'level': 'o_level',
        'year': 2023, 'session': 'november', 'paper_type': 'paper_1',
        'skip_if_exists': True,  # May overlap with paper ID=1
    },
    '712333796-N-2020-P1-Mathematics-O-level-Suggested-Marking-guide-By-trotter-1.pdf': {
        'type': 'marking_scheme', 'subject': 'Mathematics', 'level': 'o_level',
        'year': 2020, 'session': 'november', 'paper_type': 'paper_1',
    },
    '720029407-MG-Zimsec-Nov-2023-p2-O-level.pdf': {
        'type': 'marking_scheme', 'subject': 'Mathematics', 'level': 'o_level',
        'year': 2023, 'session': 'november', 'paper_type': 'paper_2',
    },
    '843415426-ZIMSEC-NOV-2024-O-LEVEL-MATHS-PAPER-2-Marking-Guide.pdf': {
        'type': 'marking_scheme', 'subject': 'Mathematics', 'level': 'o_level',
        'year': 2024, 'session': 'november', 'paper_type': 'paper_2',
    },

    # ── Pure Mathematics A-Level ──
    '721794057-2021-Pure-maths-paper-1.pdf': {
        'type': 'paper', 'subject': 'Pure Mathematics', 'level': 'a_level',
        'year': 2021, 'session': 'november', 'paper_type': 'paper_1',
    },
    '959006636-2025-November-Paper-1-Maths-6042.pdf': {
        'type': 'paper', 'subject': 'Pure Mathematics', 'level': 'a_level',
        'year': 2025, 'session': 'november', 'paper_type': 'paper_1',
    },
    '460735306-6042q2-specimen-1-pdf.pdf': {
        'type': 'specimen', 'subject': 'Pure Mathematics', 'level': 'a_level',
        'title': 'Pure Mathematics Paper 2 Specimen',
    },
    '715788385-2023-PAPER-1-A-LEVEL-PURE-MATHEMATICS-FINAL-REVISION-Mr-SHARE.pdf': {
        'type': 'library', 'subject': 'Pure Mathematics', 'level': 'a_level',
        'title': 'A-Level Pure Mathematics Paper 1 Revision (2023)',
        'resource_type': 'revision',
    },

    # ── Statistics A-Level ──
    '713829759-2021-ZIMSEC-MS-PAPER-1-A-LEVEL-STATISTICS-share.pdf': {
        'type': 'library', 'subject': 'Mathematics', 'level': 'a_level',
        'title': 'A-Level Statistics Paper 1 Marking Scheme (2021)',
        'resource_type': 'revision',
    },

    # ── Chemistry ──
    '661734004-ZIMSEC-CHEMISTRY-PAPER-2-November-2022.pdf': {
        'type': 'paper', 'subject': 'Chemistry', 'level': 'o_level',
        'year': 2022, 'session': 'november', 'paper_type': 'paper_2',
    },
    '760436590-ZIMSEC-CHEMISTRY-NOV2023.pdf': {
        'type': 'paper', 'subject': 'Chemistry', 'level': 'o_level',
        'year': 2023, 'session': 'november', 'paper_type': 'paper_2',
    },
    '856932970-Chemistry-Paper-2-June-2024.pdf': {
        'type': 'paper', 'subject': 'Chemistry', 'level': 'o_level',
        'year': 2024, 'session': 'june', 'paper_type': 'paper_2',
    },
    '891717758-Chemistry-P2-June-2025.pdf': {
        'type': 'paper', 'subject': 'Chemistry', 'level': 'o_level',
        'year': 2025, 'session': 'june', 'paper_type': 'paper_2',
    },

    # ── Geography O-Level ──
    '682786686-o-levels-geography-2023.pdf': {
        'type': 'paper', 'subject': 'Geography', 'level': 'o_level',
        'year': 2023, 'session': 'november', 'paper_type': 'paper_2',
    },
    '719364910-N2021-O-Level-Geography-P2.pdf': {
        'type': 'paper', 'subject': 'Geography', 'level': 'o_level',
        'year': 2021, 'session': 'november', 'paper_type': 'paper_2',
    },
    '840183313-o-Level-Geography-n2024-Paper-2-With-Marking-Scheme.pdf': {
        'type': 'paper', 'subject': 'Geography', 'level': 'o_level',
        'year': 2024, 'session': 'november', 'paper_type': 'paper_2',
        'has_ms': True,
    },
    '888041971-Geography-Paper-2-2022.pdf': {
        'type': 'paper', 'subject': 'Geography', 'level': 'o_level',
        'year': 2022, 'session': 'november', 'paper_type': 'paper_2',
    },
    '771600190-Geography-Paper-2-June-2024.pdf': {
        'type': 'paper', 'subject': 'Geography', 'level': 'o_level',
        'year': 2024, 'session': 'june', 'paper_type': 'paper_2',
    },
    '788648788-ZIMSEC-Form-3-and-O-level-Geography-Exam-Paper-Set-1.pdf': {
        'type': 'specimen', 'subject': 'Geography', 'level': 'o_level',
        'title': 'Geography O-Level Practice Paper Set 1',
    },

    # ── English ──
    '523013958-Zimsec-O-level-English-November-2019-Past-Exam-Paper-2-pdf-eLIBRARY.pdf': {
        'type': 'paper', 'subject': 'English Language', 'level': 'o_level',
        'year': 2019, 'session': 'november', 'paper_type': 'paper_2',
    },
    '579815947-ZIMSEC-O-Level-English-2020.pdf': {
        'type': 'paper', 'subject': 'English Language', 'level': 'o_level',
        'year': 2020, 'session': 'november', 'paper_type': 'paper_1',
    },
    '746013013-english-paper-1-june-2024.pdf': {
        'type': 'paper', 'subject': 'English Language', 'level': 'o_level',
        'year': 2024, 'session': 'june', 'paper_type': 'paper_1',
    },
    '805681185-ZIMSEC-English-Paper-1-Form-3.pdf': {
        'type': 'library', 'subject': 'English Language', 'level': 'o_level',
        'title': 'English Paper 1 Form 3 Practice',
        'resource_type': 'revision',
    },
    '906367175-Zimsec-English-Language-Paper-2-June-2025-Session.pdf': {
        'type': 'paper', 'subject': 'English Language', 'level': 'o_level',
        'year': 2025, 'session': 'june', 'paper_type': 'paper_2',
    },

    # ── Biology ──
    '753197245-Biology-p2-June-2024.pdf': {
        'type': 'paper', 'subject': 'Biology', 'level': 'o_level',
        'year': 2024, 'session': 'june', 'paper_type': 'paper_2',
    },
    '516131794-Biology-Specimen-Paper-2.pdf': {
        'type': 'specimen', 'subject': 'Biology', 'level': 'o_level',
        'title': 'Biology Specimen Paper 2',
    },

    # ── Physics ──
    '827168773-Physics-O-Level-Paper-2-November-2024.pdf': {
        'type': 'paper', 'subject': 'Physics', 'level': 'o_level',
        'year': 2024, 'session': 'november', 'paper_type': 'paper_2',
    },

    # ── Shona ──
    '681410988-o-levels-shona-paper-1-2018.pdf': {
        'type': 'paper', 'subject': 'Shona', 'level': 'o_level',
        'year': 2018, 'session': 'november', 'paper_type': 'paper_1',
    },

    # ── Commerce ──
    '591671904-ZIMSEC-O-Level-Commerce-4049q2-Specimen-WXlNTiqA039c1Jq.pdf': {
        'type': 'specimen', 'subject': 'Commerce', 'level': 'o_level',
        'title': 'Commerce Paper 2 Specimen',
    },

    # ── Principles of Accounts ──
    '884071925-Principles-of-Accounts-June-2025-Paper-2.pdf': {
        'type': 'paper', 'subject': 'Principles of Accounts', 'level': 'o_level',
        'year': 2025, 'session': 'june', 'paper_type': 'paper_2',
    },

    # ── Topical collections → Library ──
    '581020307-ZIMSEC-Topical-Collection-Exercises.pdf': {
        'type': 'library', 'subject': 'Mathematics', 'level': 'o_level',
        'title': 'ZIMSEC Topical Collection Exercises',
        'resource_type': 'revision',
    },
    '911029479-ZIMSEC-Topical-Collection-Answers-1.pdf': {
        'type': 'library', 'subject': 'Mathematics', 'level': 'o_level',
        'title': 'ZIMSEC Topical Collection Answers',
        'resource_type': 'revision',
    },

    # ── Unknown specimen ──
    '507723275-4025q1-Specimen.pdf': {
        'type': 'library', 'subject': 'Mathematics', 'level': 'o_level',
        'title': 'ZIMSEC 4025 Paper 1 Specimen',
        'resource_type': 'revision',
    },

    # ── General listing (tiny file) ──
    '895478858-Zimsec-Past-Exam-Papers.pdf': {
        'type': 'library', 'subject': None, 'level': 'o_level',
        'title': 'ZIMSEC Past Exam Papers Listing',
        'resource_type': 'other',
    },
}

# Subject configuration for new subjects
NEW_SUBJECTS = {
    'Combined Science': {'code': '4006', 'color': '#06B6D4', 'icon': 'microscope'},
    'Heritage Studies': {'code': '4061', 'color': '#A855F7', 'icon': 'landmark'},
    'Pure Mathematics': {'code': '6042', 'color': '#2563EB', 'icon': 'calculator'},
    'Commerce': {'code': '4049', 'color': '#F97316', 'icon': 'briefcase'},
    'Principles of Accounts': {'code': '4048', 'color': '#14B8A6', 'icon': 'receipt'},
    'Shona': {'code': '4003', 'color': '#EC4899', 'icon': 'languages'},
}

# Syllabus codes
SYLLABUS_CODES = {
    ('Combined Science', 'o_level'): '4006',
    ('Heritage Studies', 'o_level'): '4061',
    ('Pure Mathematics', 'a_level'): '6042',
    ('Commerce', 'o_level'): '4049',
    ('Principles of Accounts', 'o_level'): '4048',
    ('Shona', 'o_level'): '4003',
    ('Geography', 'o_level'): '4022',
    ('Mathematics', 'o_level'): '4004',
    ('Mathematics', 'a_level'): '6042',
    ('Chemistry', 'o_level'): '4007',
    ('Chemistry', 'a_level'): '6035',
    ('Physics', 'o_level'): '4006',
    ('Biology', 'o_level'): '4008',
    ('English Language', 'o_level'): '4001',
}


class Command(BaseCommand):
    help = 'Import question papers from QPs/ folder with full subject mapping'

    def add_arguments(self, parser):
        parser.add_argument(
            '--folder', type=str, default=None,
            help='Path to QPs folder (defaults to project root QPs/)'
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Only classify and report, do not import'
        )

    def handle(self, *args, **options):
        folder = options['folder']
        if not folder:
            base = Path(__file__).resolve().parent.parent.parent.parent.parent
            folder = base / 'QPs'

        folder = Path(folder)
        if not folder.exists():
            self.stderr.write(self.style.ERROR(f'Folder not found: {folder}'))
            return

        dry_run = options['dry_run']

        # List all PDFs
        pdfs = list(folder.glob('*.pdf'))
        self.stdout.write(self.style.SUCCESS(f'Found {len(pdfs)} PDFs in {folder}\n'))

        # Categorize
        duplicates = []
        greenbooks = []
        papers = []
        marking_schemes = []
        specimens = []
        library_items = []
        unmapped = []

        for pdf_path in pdfs:
            fname = pdf_path.name
            if fname in DUPLICATES:
                duplicates.append(pdf_path)
            elif fname in GREENBOOKS:
                greenbooks.append(pdf_path)
            elif fname in PAPER_MAP:
                meta = PAPER_MAP[fname]
                if meta['type'] == 'paper':
                    papers.append((pdf_path, meta))
                elif meta['type'] == 'marking_scheme':
                    marking_schemes.append((pdf_path, meta))
                elif meta['type'] == 'specimen':
                    specimens.append((pdf_path, meta))
                elif meta['type'] == 'library':
                    library_items.append((pdf_path, meta))
            else:
                unmapped.append(pdf_path)

        # Report
        self.stdout.write(self.style.SUCCESS('=== Classification ==='))
        self.stdout.write(f'  Duplicates (skip): {len(duplicates)}')
        self.stdout.write(f'  Greenbooks (Phase 4): {len(greenbooks)}')
        self.stdout.write(f'  Individual Papers: {len(papers)}')
        self.stdout.write(f'  Marking Schemes: {len(marking_schemes)}')
        self.stdout.write(f'  Specimens: {len(specimens)}')
        self.stdout.write(f'  Library Resources: {len(library_items)}')
        self.stdout.write(f'  Unmapped: {len(unmapped)}')

        if unmapped:
            self.stdout.write(self.style.WARNING('\nUnmapped files:'))
            for p in unmapped:
                self.stdout.write(f'  ?? {p.name}')

        self.stdout.write('')

        if dry_run:
            self.stdout.write(self.style.SUCCESS('\n--- Individual Papers ---'))
            for pdf_path, meta in papers:
                self.stdout.write(
                    f'  [QP] {meta["subject"]} {meta.get("level","")}'
                    f' {meta["year"]} {meta["session"]} {meta["paper_type"]}'
                    f' <- {pdf_path.name}'
                )
            self.stdout.write(self.style.SUCCESS('\n--- Marking Schemes ---'))
            for pdf_path, meta in marking_schemes:
                self.stdout.write(
                    f'  [MS] {meta["subject"]} {meta["year"]} {meta["session"]} {meta["paper_type"]}'
                    f' <- {pdf_path.name}'
                )
            self.stdout.write(self.style.SUCCESS('\n--- Specimens -> Library ---'))
            for pdf_path, meta in specimens:
                self.stdout.write(f'  [SPEC] {meta["title"]} <- {pdf_path.name}')
            self.stdout.write(self.style.SUCCESS('\n--- Library Resources ---'))
            for pdf_path, meta in library_items:
                self.stdout.write(f'  [LIB] {meta["title"]} <- {pdf_path.name}')
            self.stdout.write(self.style.SUCCESS('\n--- Greenbooks (Phase 4) ---'))
            for p in greenbooks:
                pages = get_page_count(p)
                self.stdout.write(f'  [GB] {p.name} ({pages}p)')
            self.stdout.write(self.style.WARNING('\n--- DRY RUN: No changes made ---'))
            return

        # ──────────────────────────────────────────────
        # Step 1: Ensure ZIMSEC board exists
        # ──────────────────────────────────────────────
        board, _ = ExaminationBoard.objects.get_or_create(
            short_name='ZIMSEC',
            defaults={
                'name': 'Zimbabwe School Examinations Council',
                'country': 'Zimbabwe',
            }
        )

        # ──────────────────────────────────────────────
        # Step 2: Create new subjects
        # ──────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS('\n=== Creating New Subjects ==='))
        for subj_name, config in NEW_SUBJECTS.items():
            subj, created = Subject.objects.get_or_create(
                name=subj_name,
                defaults={
                    'code': config['code'],
                    'color': config['color'],
                    'icon': config['icon'],
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  Created subject: {subj_name} ({config["code"]})'))
            else:
                self.stdout.write(f'  Already exists: {subj_name}')

        # ──────────────────────────────────────────────
        # Step 3: Ensure syllabi exist
        # ──────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS('\n=== Ensuring Syllabi ==='))
        syllabi_needed = set()
        for _, meta in papers + marking_schemes:
            syllabi_needed.add((meta['subject'], meta['level']))
        for _, meta in specimens + library_items:
            if meta.get('subject'):
                syllabi_needed.add((meta['subject'], meta.get('level', 'o_level')))

        for subj_name, level in syllabi_needed:
            subject = Subject.objects.filter(name=subj_name).first()
            if not subject:
                self.stdout.write(self.style.WARNING(f'  Subject not found: {subj_name}'))
                continue

            code = SYLLABUS_CODES.get((subj_name, level), '')
            syl, created = Syllabus.objects.get_or_create(
                board=board, subject=subject, level=level,
                defaults={'syllabus_code': code}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'  Created syllabus: {syl}'))
            else:
                self.stdout.write(f'  Already exists: {syl}')

        # ──────────────────────────────────────────────
        # Step 4: Import individual papers
        # ──────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS('\n=== Importing Question Papers ==='))
        imported_count = 0
        for pdf_path, meta in papers:
            subject = Subject.objects.filter(name=meta['subject']).first()
            if not subject:
                self.stdout.write(self.style.WARNING(f'  Subject not found: {meta["subject"]}'))
                continue

            syllabus = Syllabus.objects.filter(
                board=board, subject=subject, level=meta['level']
            ).first()
            if not syllabus:
                self.stdout.write(self.style.WARNING(f'  Syllabus not found for {meta["subject"]} {meta["level"]}'))
                continue

            # Check if already exists
            existing = Paper.objects.filter(
                syllabus=syllabus,
                year=meta['year'],
                session=meta['session'],
                paper_type=meta['paper_type'],
            ).first()

            if existing:
                if meta.get('skip_if_exists'):
                    self.stdout.write(f'  Skipped duplicate: {meta["subject"]} {meta["year"]} {meta["session"]} {meta["paper_type"]}')
                else:
                    self.stdout.write(f'  Already exists: {existing.title}')
                continue

            title = f'{meta["subject"]} Paper {meta["paper_type"].split("_")[1]} ({meta["year"]} {meta["session"].title()})'

            with open(pdf_path, 'rb') as f:
                file_content = f.read()

            page_count = get_page_count(pdf_path)

            paper = Paper.objects.create(
                syllabus=syllabus,
                title=title,
                paper_type=meta['paper_type'],
                year=meta['year'],
                session=meta['session'],
                status='approved',
                is_active=True,
            )
            paper.pdf_file.save(pdf_path.name, ContentFile(file_content))
            imported_count += 1
            self.stdout.write(self.style.SUCCESS(f'  Imported: {title} ({page_count}p)'))

        # ──────────────────────────────────────────────
        # Step 5: Match marking schemes to papers
        # ──────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS('\n=== Attaching Marking Schemes ==='))
        for pdf_path, meta in marking_schemes:
            subject = Subject.objects.filter(name=meta['subject']).first()
            if not subject:
                continue

            syllabus = Syllabus.objects.filter(
                board=board, subject=subject, level=meta['level']
            ).first()
            if not syllabus:
                self.stdout.write(self.style.WARNING(f'  No syllabus for {meta["subject"]} {meta["level"]}'))
                continue

            matching_paper = Paper.objects.filter(
                syllabus=syllabus,
                year=meta['year'],
                session=meta['session'],
                paper_type=meta['paper_type'],
            ).first()

            if matching_paper and not matching_paper.marking_scheme_file:
                with open(pdf_path, 'rb') as f:
                    file_content = f.read()
                matching_paper.marking_scheme_file.save(pdf_path.name, ContentFile(file_content))
                self.stdout.write(self.style.SUCCESS(f'  Attached MS to: {matching_paper.title}'))
            elif matching_paper:
                self.stdout.write(f'  Already has MS: {matching_paper.title}')
            else:
                self.stdout.write(self.style.WARNING(
                    f'  No matching paper for MS: {meta["subject"]} {meta["year"]} {meta["session"]} {meta["paper_type"]}'
                ))

        # ──────────────────────────────────────────────
        # Step 6: Import specimens and library resources
        # ──────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS('\n=== Importing Library Resources ==='))
        all_library = specimens + library_items

        for pdf_path, meta in all_library:
            title = meta.get('title', pdf_path.stem)
            slug = slugify(title)
            if not slug:
                slug = slugify(pdf_path.stem)

            if Resource.objects.filter(slug=slug).exists():
                self.stdout.write(f'  Already exists: {title}')
                continue

            subject = None
            if meta.get('subject'):
                subject = Subject.objects.filter(name=meta['subject']).first()

            # Get or create category
            subj_name = meta.get('subject') or 'General'
            cat_slug = slugify(f'{subj_name}-resources')
            category, _ = ResourceCategory.objects.get_or_create(
                slug=cat_slug,
                defaults={
                    'name': f'{subj_name} Resources',
                    'description': f'Study materials for {subj_name}',
                    'icon': 'book-open',
                    'color': subject.color if subject else '#6366F1',
                }
            )

            page_count = get_page_count(pdf_path)
            file_size = pdf_path.stat().st_size

            resource_type = meta.get('resource_type', 'revision')
            if meta['type'] == 'specimen':
                resource_type = 'revision'

            with open(pdf_path, 'rb') as f:
                file_content = f.read()

            resource = Resource.objects.create(
                title=title,
                slug=slug,
                description=f'{title} - ZIMSEC {meta.get("level", "o_level").replace("_", " ").title()} study material',
                resource_type=resource_type,
                category=category,
                subject=subject,
                level=meta.get('level', 'o_level'),
                page_count=page_count,
                file_size_bytes=file_size,
                cover_color=subject.color if subject else '#6366F1',
                tags=[(subj_name or 'general').lower(), meta.get('level', 'o_level').replace('_', '-'), resource_type],
                is_featured=True,
                is_active=True,
            )
            resource.file.save(pdf_path.name, ContentFile(file_content))
            self.stdout.write(self.style.SUCCESS(f'  Imported: {title} ({page_count}p)'))

        # ──────────────────────────────────────────────
        # Summary
        # ──────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS(f'\n=== Import Complete ==='))
        self.stdout.write(f'  Papers imported: {imported_count}')
        self.stdout.write(f'  Greenbooks pending (Phase 4): {len(greenbooks)}')
        total_papers = Paper.objects.filter(is_active=True).count()
        total_qs = 0
        try:
            from apps.exams.models import Question
            total_qs = Question.objects.count()
        except Exception:
            pass
        self.stdout.write(f'  Total active papers: {total_papers}')
        self.stdout.write(f'  Total questions: {total_qs}')
        self.stdout.write(self.style.SUCCESS(
            '\nRun `python manage.py process_papers --unprocessed` to extract questions from new papers.'
        ))

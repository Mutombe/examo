"""
Management command to process papers using AI to extract questions.
Supports processing all papers, specific papers, or only unprocessed ones.
"""
import time
from django.core.management.base import BaseCommand
from apps.exams.models import Paper
from apps.ai_marking.paper_processing import PaperProcessingService


class Command(BaseCommand):
    help = 'Process papers with AI to extract questions (including source_position)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--paper-id',
            type=int,
            nargs='+',
            help='Specific paper ID(s) to process',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Process all papers (including those with existing questions)',
        )
        parser.add_argument(
            '--unprocessed',
            action='store_true',
            help='Only process papers with no questions',
        )
        parser.add_argument(
            '--reprocess',
            action='store_true',
            help='Reprocess papers that already have questions (deletes existing questions)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be processed without actually processing',
        )

    def handle(self, *args, **options):
        service = PaperProcessingService()

        if not service.client:
            self.stderr.write(self.style.ERROR(
                'Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env'
            ))
            return

        # Determine which papers to process
        if options['paper_id']:
            papers = Paper.objects.filter(id__in=options['paper_id'])
        elif options['unprocessed']:
            papers = Paper.objects.filter(questions__isnull=True).distinct()
            # Also include papers with 0 questions
            papers_with_questions = Paper.objects.filter(questions__isnull=False).distinct()
            papers = Paper.objects.exclude(id__in=papers_with_questions)
        elif options['all'] or options['reprocess']:
            papers = Paper.objects.all()
        else:
            # Default: process papers with 0 questions
            papers_with_questions = Paper.objects.filter(questions__isnull=False).distinct()
            papers = Paper.objects.exclude(id__in=papers_with_questions)

        papers = papers.filter(pdf_file__isnull=False).exclude(pdf_file='')

        if not papers.exists():
            self.stdout.write(self.style.WARNING('No papers to process'))
            return

        self.stdout.write(f'\nFound {papers.count()} paper(s) to process:\n')
        for p in papers:
            q_count = p.questions.count()
            self.stdout.write(
                f'  ID={p.id} | {p.title} | '
                f'questions={q_count} | '
                f'file={p.pdf_file.name}'
            )

        if options['dry_run']:
            self.stdout.write(self.style.WARNING('\n[DRY RUN] No papers were processed'))
            return

        self.stdout.write(f'\nProcessing {papers.count()} papers...\n')
        total_questions = 0
        success_count = 0
        fail_count = 0

        for paper in papers:
            existing_count = paper.questions.count()
            if existing_count > 0 and not options['reprocess'] and not options['all']:
                self.stdout.write(
                    f'  SKIP: {paper.title} (has {existing_count} questions, use --reprocess)'
                )
                continue

            self.stdout.write(f'\n  Processing: {paper.title}...')

            try:
                result = service.process_paper(paper)

                if result['success']:
                    q_count = result['questions_extracted']
                    total_questions += q_count
                    success_count += 1
                    self.stdout.write(self.style.SUCCESS(
                        f'    OK: Extracted {q_count} questions '
                        f'(total marks: {result.get("total_marks", "?")})'
                    ))
                else:
                    fail_count += 1
                    self.stdout.write(self.style.ERROR(
                        f'    FAIL: {result["error"]}'
                    ))
            except Exception as e:
                fail_count += 1
                self.stdout.write(self.style.ERROR(f'    ERROR: {e}'))

            # Rate limit - wait between API calls
            time.sleep(2)

        self.stdout.write(f'\n{"="*50}')
        self.stdout.write(f'Results:')
        self.stdout.write(f'  Successful: {success_count}')
        self.stdout.write(f'  Failed: {fail_count}')
        self.stdout.write(f'  Total questions extracted: {total_questions}')
        self.stdout.write('')

"""
Views for the exams app.
"""

from rest_framework import generics, filters, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import ExaminationBoard, Subject, Syllabus, Topic, Paper, Question
from .serializers import (
    ExaminationBoardSerializer,
    SubjectSerializer,
    SyllabusSerializer,
    SyllabusListSerializer,
    TopicSerializer,
    PaperListSerializer,
    PaperDetailSerializer,
    QuestionSerializer,
    PaperUploadSerializer,
)


class ExaminationBoardListView(generics.ListAPIView):
    """List all active examination boards."""

    queryset = ExaminationBoard.objects.filter(is_active=True)
    serializer_class = ExaminationBoardSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class SubjectListView(generics.ListAPIView):
    """List all active subjects."""

    queryset = Subject.objects.filter(is_active=True)
    serializer_class = SubjectSerializer
    permission_classes = [AllowAny]
    pagination_class = None


class SyllabusListView(generics.ListAPIView):
    """List syllabi with filtering."""

    queryset = Syllabus.objects.filter(is_active=True).select_related('board', 'subject')
    serializer_class = SyllabusListSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ['subject__name', 'board__name']

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by board
        board_id = self.request.query_params.get('board')
        if board_id:
            queryset = queryset.filter(board_id=board_id)

        # Filter by subject
        subject_id = self.request.query_params.get('subject')
        if subject_id:
            queryset = queryset.filter(subject_id=subject_id)

        # Filter by level
        level = self.request.query_params.get('level')
        if level:
            queryset = queryset.filter(level=level)

        return queryset


class PaperListView(generics.ListAPIView):
    """List papers with filtering."""

    queryset = Paper.objects.filter(is_active=True).select_related(
        'syllabus', 'syllabus__board', 'syllabus__subject'
    )
    serializer_class = PaperListSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'syllabus__subject__name']
    ordering_fields = ['year', 'created_at', 'title']
    ordering = ['-year', 'session']

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by syllabus
        syllabus_id = self.request.query_params.get('syllabus')
        if syllabus_id:
            queryset = queryset.filter(syllabus_id=syllabus_id)

        # Filter by board (through syllabus)
        board_id = self.request.query_params.get('board')
        if board_id:
            queryset = queryset.filter(syllabus__board_id=board_id)

        # Filter by subject (through syllabus)
        subject_id = self.request.query_params.get('subject')
        if subject_id:
            queryset = queryset.filter(syllabus__subject_id=subject_id)

        # Filter by level
        level = self.request.query_params.get('level')
        if level:
            queryset = queryset.filter(syllabus__level=level)

        # Filter by year
        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(year=year)

        # Filter by session
        session = self.request.query_params.get('session')
        if session:
            queryset = queryset.filter(session=session)

        return queryset


class PaperDetailView(generics.RetrieveAPIView):
    """Get paper details with questions."""

    queryset = Paper.objects.filter(is_active=True).select_related(
        'syllabus', 'syllabus__board', 'syllabus__subject'
    ).prefetch_related('questions')
    serializer_class = PaperDetailSerializer
    permission_classes = [AllowAny]


class PaperQuestionsView(generics.ListAPIView):
    """List questions for a specific paper."""

    serializer_class = QuestionSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        paper_id = self.kwargs['paper_id']
        return Question.objects.filter(paper_id=paper_id).order_by('order', 'question_number')


class TopicListView(generics.ListAPIView):
    """List topics for a syllabus."""

    serializer_class = TopicSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        syllabus_id = self.request.query_params.get('syllabus')
        queryset = Topic.objects.filter(is_active=True, parent__isnull=True)

        if syllabus_id:
            queryset = queryset.filter(syllabus_id=syllabus_id)

        return queryset.prefetch_related('subtopics')


class TopicDetailView(generics.RetrieveAPIView):
    """Get topic details with subtopics."""

    queryset = Topic.objects.filter(is_active=True).prefetch_related('subtopics', 'questions')
    serializer_class = TopicSerializer
    permission_classes = [AllowAny]


class TopicQuestionsView(generics.ListAPIView):
    """List questions for a specific topic."""

    serializer_class = QuestionSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        topic_id = self.kwargs['topic_id']
        return Question.objects.filter(topics__id=topic_id).order_by('paper__year', 'order')


class PaperUploadView(generics.CreateAPIView):
    """Upload a new paper for review."""

    permission_classes = [AllowAny]  # Anyone can upload, even guests
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = PaperUploadSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = serializer.validated_data

        # Generate paper title
        board = validated_data['board_obj']
        subject = validated_data['subject_obj']
        level_display = dict(Syllabus.LEVEL_CHOICES).get(validated_data['level'], validated_data['level'])
        session_display = dict(Paper.SESSION_CHOICES).get(validated_data['session'], validated_data['session'])
        paper_type_display = dict(Paper.PAPER_TYPE_CHOICES).get(validated_data['paper_type'], validated_data['paper_type'])

        title = f"{board.short_name} {subject.name} {level_display} {paper_type_display} - {session_display} {validated_data['year']}"

        # Create the paper with pending status
        paper = Paper.objects.create(
            syllabus=validated_data['syllabus'],
            title=title,
            paper_type=validated_data['paper_type'],
            year=validated_data['year'],
            session=validated_data['session'],
            pdf_file=validated_data['pdf_file'],
            marking_scheme_file=validated_data.get('marking_scheme_file'),
            status='pending',
            is_active=False,  # Not active until approved
            uploaded_by=request.user if request.user.is_authenticated else None,
        )

        return Response({
            'id': paper.id,
            'title': paper.title,
            'status': paper.status,
            'message': 'Paper uploaded successfully. It will be reviewed before being made available.'
        }, status=status.HTTP_201_CREATED)

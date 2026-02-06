"""
Serializers for the exams app.
"""

from rest_framework import serializers

from .models import ExaminationBoard, Subject, Syllabus, Topic, Paper, Question


class ExaminationBoardSerializer(serializers.ModelSerializer):
    """Serializer for ExaminationBoard."""

    class Meta:
        model = ExaminationBoard
        fields = [
            'id', 'name', 'short_name', 'description', 'country',
            'website', 'logo', 'is_active', 'created_at'
        ]


class SubjectSerializer(serializers.ModelSerializer):
    """Serializer for Subject."""

    class Meta:
        model = Subject
        fields = [
            'id', 'name', 'code', 'description', 'icon', 'color',
            'is_active', 'created_at'
        ]


class SyllabusSerializer(serializers.ModelSerializer):
    """Serializer for Syllabus."""

    board = ExaminationBoardSerializer(read_only=True)
    subject = SubjectSerializer(read_only=True)
    level_display = serializers.CharField(source='get_level_display', read_only=True)

    class Meta:
        model = Syllabus
        fields = [
            'id', 'board', 'subject', 'level', 'level_display',
            'syllabus_code', 'year_from', 'year_to', 'is_active', 'created_at'
        ]


class SyllabusListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Syllabus list view."""

    board_name = serializers.CharField(source='board.short_name', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    level_display = serializers.CharField(source='get_level_display', read_only=True)

    class Meta:
        model = Syllabus
        fields = [
            'id', 'board_name', 'subject_name', 'level', 'level_display',
            'syllabus_code', 'is_active'
        ]


class TopicSerializer(serializers.ModelSerializer):
    """Serializer for Topic."""

    subtopics = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = Topic
        fields = [
            'id', 'name', 'slug', 'description', 'order', 'objectives',
            'parent', 'subtopics', 'question_count', 'is_active'
        ]

    def get_subtopics(self, obj):
        subtopics = obj.subtopics.filter(is_active=True)
        return TopicSerializer(subtopics, many=True).data

    def get_question_count(self, obj):
        return obj.questions.count()


class TopicListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Topic list."""

    class Meta:
        model = Topic
        fields = ['id', 'name', 'slug', 'order']


class QuestionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Question list."""

    type_display = serializers.CharField(source='get_question_type_display', read_only=True)

    class Meta:
        model = Question
        fields = [
            'id', 'question_number', 'question_text', 'question_type',
            'type_display', 'marks', 'topic_text', 'difficulty'
        ]


class QuestionSerializer(serializers.ModelSerializer):
    """Serializer for Question."""

    type_display = serializers.CharField(source='get_question_type_display', read_only=True)
    topics = TopicListSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            'id', 'question_number', 'question_text', 'question_type',
            'type_display', 'marks', 'options', 'topic_text', 'topics',
            'difficulty', 'image', 'order',
            # Source reference fields
            'source_page', 'source_position', 'has_diagram', 'diagram_description'
        ]


class QuestionDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Question (includes marking scheme for teachers)."""

    type_display = serializers.CharField(source='get_question_type_display', read_only=True)
    topics = TopicListSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            'id', 'question_number', 'question_text', 'question_type',
            'type_display', 'marks', 'options', 'correct_answer',
            'marking_scheme', 'sample_answer', 'topic_text', 'topics',
            'difficulty', 'image', 'order', 'created_at',
            # Source reference fields
            'source_page', 'has_diagram', 'diagram_description'
        ]


class PaperListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Paper list view."""

    syllabus = SyllabusListSerializer(read_only=True)
    session_display = serializers.CharField(source='get_session_display', read_only=True)
    paper_type_display = serializers.CharField(source='get_paper_type_display', read_only=True)
    question_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Paper
        fields = [
            'id', 'title', 'syllabus', 'paper_type', 'paper_type_display',
            'year', 'session', 'session_display', 'duration_minutes',
            'total_marks', 'question_count', 'is_active'
        ]


class PaperDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Paper."""

    syllabus = SyllabusSerializer(read_only=True)
    session_display = serializers.CharField(source='get_session_display', read_only=True)
    paper_type_display = serializers.CharField(source='get_paper_type_display', read_only=True)
    questions = QuestionSerializer(many=True, read_only=True)
    question_count = serializers.IntegerField(read_only=True)
    pdf_url = serializers.SerializerMethodField()
    marking_scheme_url = serializers.SerializerMethodField()

    class Meta:
        model = Paper
        fields = [
            'id', 'title', 'syllabus', 'paper_type', 'paper_type_display',
            'year', 'session', 'session_display', 'duration_minutes',
            'total_marks', 'instructions', 'pdf_file', 'marking_scheme_file',
            'pdf_url', 'marking_scheme_url',
            'questions', 'question_count', 'status', 'is_active', 'created_at'
        ]

    def get_pdf_url(self, obj):
        """Get full URL for the PDF file."""
        if obj.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None

    def get_marking_scheme_url(self, obj):
        """Get full URL for the marking scheme file."""
        if obj.marking_scheme_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.marking_scheme_file.url)
            return obj.marking_scheme_file.url
        return None


class PaperUploadSerializer(serializers.Serializer):
    """Serializer for paper upload endpoint."""

    # Accept both naming conventions from frontend
    paper_file = serializers.FileField(required=True)
    marking_scheme_file = serializers.FileField(required=False, allow_null=True)
    board_id = serializers.IntegerField(required=True)
    subject_id = serializers.IntegerField(required=True)
    level = serializers.ChoiceField(choices=Syllabus.LEVEL_CHOICES, required=True)
    year = serializers.IntegerField(required=True)
    session = serializers.ChoiceField(choices=Paper.SESSION_CHOICES, required=True)
    paper_type = serializers.ChoiceField(choices=Paper.PAPER_TYPE_CHOICES, required=True)
    title = serializers.CharField(required=False, allow_blank=True)

    def validate_paper_file(self, value):
        """Validate that the uploaded file is a PDF."""
        if not value.name.lower().endswith('.pdf'):
            raise serializers.ValidationError("Only PDF files are allowed.")
        # Limit file size to 50MB
        if value.size > 50 * 1024 * 1024:
            raise serializers.ValidationError("File size must be under 50MB.")
        return value

    def validate_marking_scheme_file(self, value):
        """Validate that the marking scheme file is a PDF."""
        if value and not value.name.lower().endswith('.pdf'):
            raise serializers.ValidationError("Only PDF files are allowed for marking scheme.")
        if value and value.size > 50 * 1024 * 1024:
            raise serializers.ValidationError("File size must be under 50MB.")
        return value

    def validate_year(self, value):
        """Validate the year is reasonable."""
        import datetime
        current_year = datetime.datetime.now().year
        if value < 1990 or value > current_year + 1:
            raise serializers.ValidationError(f"Year must be between 1990 and {current_year + 1}.")
        return value

    def validate(self, data):
        """Validate that the syllabus exists for the given board, subject, and level."""
        from .models import ExaminationBoard, Subject, Syllabus

        # Check board exists
        try:
            board = ExaminationBoard.objects.get(id=data['board_id'], is_active=True)
        except ExaminationBoard.DoesNotExist:
            raise serializers.ValidationError({"board_id": "Invalid examination board."})

        # Check subject exists
        try:
            subject = Subject.objects.get(id=data['subject_id'], is_active=True)
        except Subject.DoesNotExist:
            raise serializers.ValidationError({"subject_id": "Invalid subject."})

        # Get or create syllabus
        syllabus, created = Syllabus.objects.get_or_create(
            board=board,
            subject=subject,
            level=data['level'],
            defaults={'is_active': True}
        )

        data['syllabus'] = syllabus
        data['board_obj'] = board
        data['subject_obj'] = subject
        # Copy paper_file to pdf_file for the view to use
        data['pdf_file'] = data['paper_file']

        return data

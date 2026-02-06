"""
Serializers for the attempts app.
"""

from django.utils import timezone
from rest_framework import serializers

from apps.exams.serializers import PaperListSerializer, QuestionSerializer
from .models import Attempt, Answer


class AnswerSerializer(serializers.ModelSerializer):
    """Serializer for Answer."""

    question = QuestionSerializer(read_only=True)
    question_id = serializers.IntegerField(write_only=True)
    time_spent_formatted = serializers.SerializerMethodField()

    class Meta:
        model = Answer
        fields = [
            'id', 'question', 'question_id', 'answer_text', 'selected_option',
            'is_correct', 'score', 'feedback', 'ai_marked', 'marked_at',
            # Confidence fields
            'confidence_score', 'confidence_level',
            # Tracking fields
            'time_spent_seconds', 'time_spent_formatted', 'first_viewed_at',
            'last_viewed_at', 'view_count', 'pdf_reference_clicks',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'is_correct', 'score', 'feedback', 'ai_marked', 'marked_at',
            'confidence_score', 'confidence_level',
            'time_spent_seconds', 'first_viewed_at', 'last_viewed_at',
            'view_count', 'pdf_reference_clicks'
        ]

    def get_time_spent_formatted(self, obj):
        """Format time spent as MM:SS or HH:MM:SS."""
        seconds = obj.time_spent_seconds
        if seconds >= 3600:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            secs = seconds % 60
            return f"{hours}:{minutes:02d}:{secs:02d}"
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}:{secs:02d}"


class AnswerCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating answers."""

    class Meta:
        model = Answer
        fields = ['attempt', 'question', 'answer_text', 'selected_option']

    def validate(self, attrs):
        attempt = attrs.get('attempt')
        question = attrs.get('question')

        # Ensure question belongs to the paper being attempted
        if question.paper != attempt.paper:
            raise serializers.ValidationError(
                "Question does not belong to this paper."
            )

        # Ensure attempt is still in progress
        if attempt.status != 'in_progress':
            raise serializers.ValidationError(
                "Cannot modify answers for a submitted attempt."
            )

        return attrs

    def create(self, validated_data):
        # Use update_or_create to handle both create and update
        attempt = validated_data['attempt']
        question = validated_data['question']

        answer, created = Answer.objects.update_or_create(
            attempt=attempt,
            question=question,
            defaults={
                'answer_text': validated_data.get('answer_text', ''),
                'selected_option': validated_data.get('selected_option', ''),
            }
        )
        return answer


class AttemptSerializer(serializers.ModelSerializer):
    """Serializer for Attempt."""

    paper = PaperListSerializer(read_only=True)
    paper_id = serializers.IntegerField(write_only=True)
    answers = AnswerSerializer(many=True, read_only=True)

    class Meta:
        model = Attempt
        fields = [
            'id', 'paper', 'paper_id', 'status', 'started_at', 'submitted_at',
            'marked_at', 'total_score', 'percentage', 'time_spent_seconds',
            'answers'
        ]
        read_only_fields = [
            'status', 'started_at', 'submitted_at', 'marked_at',
            'total_score', 'percentage'
        ]


class AttemptCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating an attempt."""

    class Meta:
        model = Attempt
        fields = ['id', 'paper', 'status', 'started_at']
        read_only_fields = ['id', 'status', 'started_at']


class AttemptListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for attempt list."""

    paper = PaperListSerializer(read_only=True)
    answer_count = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = [
            'id', 'paper', 'status', 'started_at', 'submitted_at',
            'total_score', 'percentage', 'time_spent_seconds', 'answer_count'
        ]

    def get_answer_count(self, obj):
        return obj.answers.count()


class AttemptSubmitSerializer(serializers.Serializer):
    """Serializer for submitting an attempt."""

    time_spent_seconds = serializers.IntegerField(required=False, default=0)


class AttemptResultSerializer(serializers.ModelSerializer):
    """Serializer for attempt results with detailed answers."""

    paper = PaperListSerializer(read_only=True)
    answers = AnswerSerializer(many=True, read_only=True)
    time_spent_formatted = serializers.SerializerMethodField()
    total_pause_time_formatted = serializers.SerializerMethodField()
    active_time_seconds = serializers.SerializerMethodField()
    active_time_formatted = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = [
            'id', 'paper', 'status', 'started_at', 'submitted_at',
            'marked_at', 'total_score', 'percentage', 'time_spent_seconds',
            'time_spent_formatted',
            # Enhanced tracking fields
            'last_activity_at', 'total_pause_time_seconds', 'total_pause_time_formatted',
            'active_time_seconds', 'active_time_formatted',
            'last_question_index', 'questions_viewed', 'pdf_views', 'pdf_last_page_viewed',
            'answers'
        ]

    def get_time_spent_formatted(self, obj):
        """Format time spent as MM:SS or HH:MM:SS."""
        seconds = obj.time_spent_seconds
        if seconds >= 3600:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            secs = seconds % 60
            return f"{hours}:{minutes:02d}:{secs:02d}"
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}:{secs:02d}"

    def get_total_pause_time_formatted(self, obj):
        """Format total pause time as MM:SS."""
        seconds = obj.total_pause_time_seconds
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}:{secs:02d}"

    def get_active_time_seconds(self, obj):
        """Get active time (total time minus pause time)."""
        return obj.time_spent_seconds - obj.total_pause_time_seconds

    def get_active_time_formatted(self, obj):
        """Format active time as MM:SS or HH:MM:SS."""
        seconds = obj.time_spent_seconds - obj.total_pause_time_seconds
        if seconds >= 3600:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            secs = seconds % 60
            return f"{hours}:{minutes:02d}:{secs:02d}"
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}:{secs:02d}"

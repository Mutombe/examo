"""
Serializers for the progress app.
"""

from rest_framework import serializers

from apps.exams.serializers import TopicListSerializer, QuestionListSerializer, PaperListSerializer
from .models import TopicProgress, StudySession, Bookmark


class TopicProgressSerializer(serializers.ModelSerializer):
    """Serializer for TopicProgress."""

    topic = TopicListSerializer(read_only=True)
    mastery_level_display = serializers.CharField(source='get_mastery_level_display', read_only=True)
    accuracy = serializers.SerializerMethodField()

    class Meta:
        model = TopicProgress
        fields = [
            'id', 'topic', 'questions_attempted', 'questions_correct',
            'total_marks_earned', 'total_marks_possible', 'mastery_level',
            'mastery_level_display', 'mastery_score', 'accuracy',
            'last_practiced_at', 'updated_at'
        ]

    def get_accuracy(self, obj):
        if obj.questions_attempted == 0:
            return 0
        return round((obj.questions_correct / obj.questions_attempted) * 100, 1)


class TopicProgressSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for topic progress summaries."""

    topic_name = serializers.CharField(source='topic.name', read_only=True)
    syllabus_name = serializers.CharField(source='topic.syllabus.display_name', read_only=True)

    class Meta:
        model = TopicProgress
        fields = [
            'id', 'topic_name', 'syllabus_name', 'mastery_level',
            'mastery_score', 'questions_attempted', 'last_practiced_at'
        ]


class StudySessionSerializer(serializers.ModelSerializer):
    """Serializer for StudySession."""

    accuracy = serializers.ReadOnlyField()
    time_spent_formatted = serializers.SerializerMethodField()

    class Meta:
        model = StudySession
        fields = [
            'id', 'date', 'time_spent_seconds', 'time_spent_formatted',
            'questions_attempted', 'questions_correct', 'marks_earned',
            'marks_possible', 'accuracy', 'streak_maintained'
        ]

    def get_time_spent_formatted(self, obj):
        hours = obj.time_spent_seconds // 3600
        minutes = (obj.time_spent_seconds % 3600) // 60
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"


class StudyStreakSerializer(serializers.Serializer):
    """Serializer for study streak information."""

    current_streak = serializers.IntegerField()
    longest_streak = serializers.IntegerField()
    total_study_days = serializers.IntegerField()
    total_questions = serializers.IntegerField()
    total_time_seconds = serializers.IntegerField()
    recent_sessions = StudySessionSerializer(many=True)


class BookmarkPaperSerializer(serializers.Serializer):
    """Lightweight paper serializer for bookmarks."""
    id = serializers.IntegerField()
    title = serializers.CharField()
    year = serializers.IntegerField()
    session_display = serializers.CharField()
    subject_name = serializers.SerializerMethodField()
    level_display = serializers.SerializerMethodField()

    def get_subject_name(self, obj):
        return obj.syllabus.subject.name if obj.syllabus else ''

    def get_level_display(self, obj):
        return obj.syllabus.get_level_display() if obj.syllabus else ''


class BookmarkResourceSerializer(serializers.Serializer):
    """Lightweight resource serializer for bookmarks."""
    id = serializers.IntegerField()
    title = serializers.CharField()
    slug = serializers.CharField()
    resource_type = serializers.CharField()
    type_display = serializers.SerializerMethodField()

    def get_type_display(self, obj):
        return obj.get_resource_type_display()


class BookmarkSerializer(serializers.ModelSerializer):
    """Serializer for Bookmark."""

    question = QuestionListSerializer(read_only=True)
    paper = BookmarkPaperSerializer(read_only=True)
    resource = BookmarkResourceSerializer(read_only=True)
    folder_display = serializers.CharField(source='get_folder_display', read_only=True)

    class Meta:
        model = Bookmark
        fields = [
            'id', 'bookmark_type', 'question', 'paper', 'resource',
            'note', 'folder', 'folder_display', 'created_at'
        ]


class BookmarkCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a Bookmark."""

    class Meta:
        model = Bookmark
        fields = ['bookmark_type', 'question', 'paper', 'resource', 'note', 'folder']

    def validate(self, data):
        bookmark_type = data.get('bookmark_type', 'question')
        if bookmark_type == 'question' and not data.get('question'):
            raise serializers.ValidationError('Question is required for question bookmarks.')
        if bookmark_type == 'paper' and not data.get('paper'):
            raise serializers.ValidationError('Paper is required for paper bookmarks.')
        if bookmark_type == 'resource' and not data.get('resource'):
            raise serializers.ValidationError('Resource is required for resource bookmarks.')
        return data


class BookmarkUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating a Bookmark."""

    class Meta:
        model = Bookmark
        fields = ['note', 'folder']


class OverallProgressSerializer(serializers.Serializer):
    """Serializer for overall progress statistics."""

    total_questions_attempted = serializers.IntegerField()
    total_questions_correct = serializers.IntegerField()
    total_marks_earned = serializers.IntegerField()
    total_marks_possible = serializers.IntegerField()
    overall_accuracy = serializers.FloatField()
    overall_score = serializers.FloatField()
    topics_started = serializers.IntegerField()
    topics_mastered = serializers.IntegerField()
    current_streak_days = serializers.IntegerField()
    total_study_time_seconds = serializers.IntegerField()
    subjects_studied = serializers.ListField(child=serializers.DictField())

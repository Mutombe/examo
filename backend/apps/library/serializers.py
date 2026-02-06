from rest_framework import serializers
from .models import ResourceCategory, Resource, ReadingProgress, ResourceRating, ResourceHighlight


class ResourceCategorySerializer(serializers.ModelSerializer):
    resource_count = serializers.SerializerMethodField()

    class Meta:
        model = ResourceCategory
        fields = ['id', 'name', 'slug', 'description', 'icon', 'color', 'order', 'resource_count']

    def get_resource_count(self, obj):
        return obj.resources.filter(is_active=True).count()


class ResourceListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, default='')
    subject_name = serializers.CharField(source='subject.name', read_only=True, default='')
    level_display = serializers.CharField(source='get_level_display', read_only=True)
    type_display = serializers.CharField(source='get_resource_type_display', read_only=True)
    file_size_display = serializers.CharField(read_only=True)
    reading_progress = serializers.SerializerMethodField()

    class Meta:
        model = Resource
        fields = [
            'id', 'title', 'slug', 'description', 'resource_type', 'type_display',
            'category_name', 'subject_name', 'level', 'level_display',
            'page_count', 'file_size_display',
            'cover_image', 'cover_color',
            'view_count', 'share_count', 'avg_rating', 'total_ratings',
            'tags', 'is_featured',
            'reading_progress',
            'created_at',
        ]

    def get_reading_progress(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                progress = ReadingProgress.objects.get(user=request.user, resource=obj)
                return {
                    'current_page': progress.current_page,
                    'progress_percent': progress.progress_percent,
                    'is_completed': progress.is_completed,
                    'last_read_at': progress.last_read_at.isoformat(),
                }
            except ReadingProgress.DoesNotExist:
                pass
        return None


class ResourceDetailSerializer(ResourceListSerializer):
    file_url = serializers.SerializerMethodField()
    user_rating = serializers.SerializerMethodField()
    highlights = serializers.SerializerMethodField()

    class Meta(ResourceListSerializer.Meta):
        fields = ResourceListSerializer.Meta.fields + [
            'file_url', 'user_rating', 'highlights',
        ]

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

    def get_user_rating(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            try:
                rating = ResourceRating.objects.get(user=request.user, resource=obj)
                return rating.rating
            except ResourceRating.DoesNotExist:
                pass
        return None

    def get_highlights(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return ResourceHighlightSerializer(
                obj.highlights.filter(user=request.user),
                many=True
            ).data
        return []


class ReadingProgressSerializer(serializers.ModelSerializer):
    resource_title = serializers.CharField(source='resource.title', read_only=True)
    progress_percent = serializers.IntegerField(read_only=True)

    class Meta:
        model = ReadingProgress
        fields = [
            'id', 'resource', 'resource_title', 'current_page',
            'total_pages_read', 'time_spent_seconds',
            'is_completed', 'completed_at', 'last_read_at',
            'started_at', 'progress_percent'
        ]
        read_only_fields = ['is_completed', 'completed_at', 'started_at']


class ResourceRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceRating
        fields = ['id', 'resource', 'rating', 'created_at']
        read_only_fields = ['created_at']


class ResourceHighlightSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceHighlight
        fields = ['id', 'resource', 'page_number', 'note', 'color', 'created_at']
        read_only_fields = ['created_at']

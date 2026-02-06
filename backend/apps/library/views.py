from django.db.models import F
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ResourceCategory, Resource, ReadingProgress, ResourceRating, ResourceHighlight
from .serializers import (
    ResourceCategorySerializer,
    ResourceListSerializer,
    ResourceDetailSerializer,
    ReadingProgressSerializer,
    ResourceRatingSerializer,
    ResourceHighlightSerializer,
)


class ResourceCategoryListView(generics.ListAPIView):
    """List all active resource categories."""
    serializer_class = ResourceCategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return ResourceCategory.objects.filter(is_active=True)


class ResourceListView(generics.ListAPIView):
    """List resources with filtering by category, subject, level, type."""
    serializer_class = ResourceListSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = Resource.objects.filter(is_active=True).select_related('category', 'subject')

        # Filters
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__slug=category)

        subject = self.request.query_params.get('subject')
        if subject:
            qs = qs.filter(subject_id=subject)

        level = self.request.query_params.get('level')
        if level:
            qs = qs.filter(level=level)

        resource_type = self.request.query_params.get('type')
        if resource_type:
            qs = qs.filter(resource_type=resource_type)

        featured = self.request.query_params.get('featured')
        if featured and featured.lower() in ('true', '1'):
            qs = qs.filter(is_featured=True)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(title__icontains=search)

        return qs


class ResourceDetailView(generics.RetrieveAPIView):
    """Get resource detail. Increments view count."""
    serializer_class = ResourceDetailSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        return Resource.objects.filter(is_active=True)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Increment view count
        Resource.objects.filter(pk=instance.pk).update(view_count=F('view_count') + 1)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class ResourceShareView(APIView):
    """Track a share action on a resource."""
    permission_classes = [AllowAny]

    def post(self, request, slug):
        try:
            resource = Resource.objects.get(slug=slug, is_active=True)
            Resource.objects.filter(pk=resource.pk).update(share_count=F('share_count') + 1)
            return Response({'status': 'shared'})
        except Resource.DoesNotExist:
            return Response({'error': 'Resource not found'}, status=404)


class ReadingProgressView(APIView):
    """Update reading progress for authenticated users."""
    permission_classes = [IsAuthenticated]

    def get(self, request, resource_id):
        """Get reading progress for a resource."""
        try:
            progress = ReadingProgress.objects.get(user=request.user, resource_id=resource_id)
            return Response(ReadingProgressSerializer(progress).data)
        except ReadingProgress.DoesNotExist:
            return Response({'current_page': 1, 'progress_percent': 0})

    def post(self, request, resource_id):
        """Update reading progress."""
        try:
            resource = Resource.objects.get(pk=resource_id, is_active=True)
        except Resource.DoesNotExist:
            return Response({'error': 'Resource not found'}, status=404)

        current_page = request.data.get('current_page', 1)
        time_spent = request.data.get('time_spent_seconds', 0)

        progress, created = ReadingProgress.objects.get_or_create(
            user=request.user,
            resource=resource,
        )

        progress.current_page = current_page
        progress.time_spent_seconds = F('time_spent_seconds') + time_spent

        # Track pages read
        if current_page > progress.total_pages_read:
            progress.total_pages_read = current_page

        # Mark as completed
        if current_page >= resource.page_count and resource.page_count > 0:
            progress.is_completed = True
            progress.completed_at = timezone.now()

        progress.save()
        progress.refresh_from_db()
        return Response(ReadingProgressSerializer(progress).data)


class ResourceRateView(APIView):
    """Rate a resource."""
    permission_classes = [IsAuthenticated]

    def post(self, request, resource_id):
        rating_val = request.data.get('rating')
        if not rating_val or not isinstance(rating_val, int) or rating_val < 1 or rating_val > 5:
            return Response({'error': 'Rating must be 1-5'}, status=400)

        try:
            resource = Resource.objects.get(pk=resource_id, is_active=True)
        except Resource.DoesNotExist:
            return Response({'error': 'Resource not found'}, status=404)

        rating, created = ResourceRating.objects.update_or_create(
            user=request.user,
            resource=resource,
            defaults={'rating': rating_val}
        )
        return Response(ResourceRatingSerializer(rating).data)


class ResourceHighlightListCreateView(APIView):
    """List and create highlights for a resource."""
    permission_classes = [IsAuthenticated]

    def get(self, request, resource_id):
        highlights = ResourceHighlight.objects.filter(
            user=request.user, resource_id=resource_id
        )
        return Response(ResourceHighlightSerializer(highlights, many=True).data)

    def post(self, request, resource_id):
        try:
            resource = Resource.objects.get(pk=resource_id, is_active=True)
        except Resource.DoesNotExist:
            return Response({'error': 'Resource not found'}, status=404)

        highlight = ResourceHighlight.objects.create(
            user=request.user,
            resource=resource,
            page_number=request.data.get('page_number', 1),
            note=request.data.get('note', ''),
            color=request.data.get('color', '#FDE047'),
        )
        return Response(ResourceHighlightSerializer(highlight).data, status=201)


class ResourceHighlightDeleteView(APIView):
    """Delete a highlight."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            highlight = ResourceHighlight.objects.get(pk=pk, user=request.user)
            highlight.delete()
            return Response(status=204)
        except ResourceHighlight.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)


class MyReadingListView(generics.ListAPIView):
    """Get user's reading list with progress."""
    serializer_class = ReadingProgressSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return ReadingProgress.objects.filter(
            user=self.request.user
        ).select_related('resource')


class FeaturedResourcesView(generics.ListAPIView):
    """Get featured resources for the home page."""
    serializer_class = ResourceListSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        return Resource.objects.filter(
            is_active=True, is_featured=True
        ).select_related('category', 'subject')[:6]

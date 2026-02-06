from django.contrib import admin
from .models import ResourceCategory, Resource, ReadingProgress, ResourceRating, ResourceHighlight


@admin.register(ResourceCategory)
class ResourceCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'order', 'is_active']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    list_display = ['title', 'resource_type', 'subject', 'level', 'view_count', 'is_featured', 'is_active']
    list_filter = ['resource_type', 'level', 'is_featured', 'is_active', 'category']
    search_fields = ['title', 'description']
    prepopulated_fields = {'slug': ('title',)}


@admin.register(ReadingProgress)
class ReadingProgressAdmin(admin.ModelAdmin):
    list_display = ['user', 'resource', 'current_page', 'progress_percent', 'is_completed']


@admin.register(ResourceRating)
class ResourceRatingAdmin(admin.ModelAdmin):
    list_display = ['user', 'resource', 'rating']

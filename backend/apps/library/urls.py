from django.urls import path
from . import views

urlpatterns = [
    # Public
    path('library/categories/', views.ResourceCategoryListView.as_view(), name='library-categories'),
    path('library/', views.ResourceListView.as_view(), name='library-list'),
    path('library/featured/', views.FeaturedResourcesView.as_view(), name='library-featured'),
    path('library/<slug:slug>/', views.ResourceDetailView.as_view(), name='library-detail'),
    path('library/<slug:slug>/share/', views.ResourceShareView.as_view(), name='library-share'),

    # Authenticated
    path('library/resource/<int:resource_id>/progress/', views.ReadingProgressView.as_view(), name='library-progress'),
    path('library/resource/<int:resource_id>/rate/', views.ResourceRateView.as_view(), name='library-rate'),
    path('library/resource/<int:resource_id>/highlights/', views.ResourceHighlightListCreateView.as_view(), name='library-highlights'),
    path('library/highlights/<int:pk>/', views.ResourceHighlightDeleteView.as_view(), name='library-highlight-delete'),
    path('library/my-reading-list/', views.MyReadingListView.as_view(), name='library-my-reading'),
]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SubmissionViewSet, create_room, room_detail, room_stream

router = DefaultRouter()
router.register('submissions', SubmissionViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # 房间管理
    path('rooms/', create_room, name='create_room'),
    path('rooms/<str:code>/', room_detail, name='room_detail'),
    path('rooms/<str:code>/stream/', room_stream, name='room_stream'),
]

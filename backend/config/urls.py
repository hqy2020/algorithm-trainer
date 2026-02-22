from django.contrib import admin
from django.conf import settings
from django.urls import path, include
from django.views.generic.base import RedirectView

urlpatterns = [
    path('', RedirectView.as_view(url=settings.FRONTEND_URL, permanent=False), name='root-redirect-to-frontend'),
    path('admin/', admin.site.urls),
    path('api/', include('users.urls')),
    path('api/', include('problems.urls')),
    path('api/', include('submissions.urls')),
    path('api/', include('notes.urls')),
]

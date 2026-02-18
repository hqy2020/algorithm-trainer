from django.contrib import admin
from .models import Submission


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('user', 'problem', 'is_passed', 'time_spent', 'created_at')
    list_filter = ('is_passed', 'user', 'problem__difficulty')
    readonly_fields = ('created_at',)

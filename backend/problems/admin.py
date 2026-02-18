from django.contrib import admin
from .models import Problem


@admin.register(Problem)
class ProblemAdmin(admin.ModelAdmin):
    list_display = ('number', 'title', 'difficulty', 'category', 'time_standard')
    list_filter = ('difficulty', 'category')
    search_fields = ('number', 'title')
    list_editable = ('difficulty', 'category', 'time_standard')
    ordering = ('number',)
    fieldsets = (
        ('基本信息', {
            'fields': ('number', 'title', 'difficulty', 'category', 'leetcode_url', 'time_standard')
        }),
        ('题目内容', {
            'fields': ('description',),
            'classes': ('collapse',),
        }),
        ('参考答案', {
            'fields': ('solution_code', 'solution_explanation'),
            'classes': ('collapse',),
        }),
    )

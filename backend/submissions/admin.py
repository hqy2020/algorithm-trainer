from django.contrib import admin
from .models import Submission, AIReviewPrompt, AIProviderConfig


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('user', 'problem', 'is_passed', 'time_spent', 'created_at')
    list_filter = ('is_passed', 'user', 'problem__difficulty')
    readonly_fields = ('created_at',)
    search_fields = ('user__name', 'problem__title', 'problem__number')
    fieldsets = (
        ('提交信息', {
            'fields': ('user', 'problem', 'is_passed', 'time_spent', 'test_cases_total', 'test_cases_passed')
        }),
        ('代码与反馈', {
            'fields': ('code', 'feedback', 'ai_feedback'),
        }),
        ('时间', {
            'fields': ('created_at',),
        }),
    )


@admin.register(AIReviewPrompt)
class AIReviewPromptAdmin(admin.ModelAdmin):
    list_display = ('result_type', 'updated_at')
    readonly_fields = ('created_at', 'updated_at')
    search_fields = ('result_type', 'prompt')


@admin.register(AIProviderConfig)
class AIProviderConfigAdmin(admin.ModelAdmin):
    list_display = ('provider_name', 'is_active', 'model_name', 'api_key_status', 'updated_at')
    readonly_fields = ('created_at', 'updated_at', 'api_key_status')
    fieldsets = (
        ('基础配置', {
            'fields': ('provider_name', 'is_active')
        }),
        ('连接配置', {
            'fields': ('api_base_url', 'api_key', 'model_name', 'timeout_seconds', 'api_key_status')
        }),
        ('时间', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

    @admin.display(description='API Key 状态')
    def api_key_status(self, obj):
        return '已配置' if (obj.api_key or '').strip() else '未配置'

    def has_add_permission(self, request):
        if AIProviderConfig.objects.exists():
            return False
        return super().has_add_permission(request)

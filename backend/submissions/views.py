from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Avg, Count, Q, F
from django.db.models.functions import TruncDate
from .models import Submission
from .serializers import SubmissionSerializer


class SubmissionViewSet(viewsets.ModelViewSet):
    queryset = Submission.objects.select_related('user', 'problem')
    serializer_class = SubmissionSerializer
    filterset_fields = ['user', 'problem', 'is_passed']

    def get_queryset(self):
        qs = super().get_queryset()
        user_id = self.request.query_params.get('user')
        problem_id = self.request.query_params.get('problem')
        if user_id:
            qs = qs.filter(user_id=user_id)
        if problem_id:
            qs = qs.filter(problem_id=problem_id)
        return qs

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """统计 API：支持按 user 筛选"""
        user_id = request.query_params.get('user')
        qs = Submission.objects.select_related('problem')
        if user_id:
            qs = qs.filter(user_id=user_id)

        total = qs.count()
        passed = qs.filter(is_passed=True).count()
        avg_time = qs.aggregate(avg=Avg('time_spent'))['avg'] or 0

        # 按难度统计
        by_difficulty = qs.values('problem__difficulty').annotate(
            count=Count('id'),
            passed_count=Count('id', filter=Q(is_passed=True)),
            avg_time=Avg('time_spent'),
        )

        # 按分类统计
        by_category = qs.values('problem__category').annotate(
            count=Count('id'),
            passed_count=Count('id', filter=Q(is_passed=True)),
            avg_time=Avg('time_spent'),
        )

        # 每日刷题数（近30天）
        daily = qs.annotate(date=TruncDate('created_at')).values('date').annotate(
            count=Count('id'),
        ).order_by('-date')[:30]

        return Response({
            'total_submissions': total,
            'total_passed': passed,
            'pass_rate': round(passed / total * 100, 1) if total else 0,
            'avg_time_seconds': round(avg_time, 1),
            'by_difficulty': list(by_difficulty),
            'by_category': list(by_category),
            'daily': list(daily),
        })

    @action(detail=False, methods=['get'])
    def compare(self, request):
        """双人对比统计"""
        from users.models import Profile
        profiles = Profile.objects.all()
        result = []
        for profile in profiles:
            qs = Submission.objects.filter(user=profile)
            total = qs.count()
            passed = qs.filter(is_passed=True).count()

            by_difficulty = {}
            for diff in ['Easy', 'Medium', 'Hard']:
                diff_qs = qs.filter(problem__difficulty=diff)
                diff_total = diff_qs.count()
                diff_passed = diff_qs.filter(is_passed=True).count()
                by_difficulty[diff] = {
                    'count': diff_total,
                    'passed': diff_passed,
                    'avg_time': round(diff_qs.aggregate(avg=Avg('time_spent'))['avg'] or 0, 1),
                }

            # 已完成的唯一题目数
            unique_solved = qs.filter(is_passed=True).values('problem').distinct().count()

            result.append({
                'user_id': profile.id,
                'user_name': profile.name,
                'user_color': profile.color,
                'total_submissions': total,
                'total_passed': passed,
                'pass_rate': round(passed / total * 100, 1) if total else 0,
                'unique_solved': unique_solved,
                'by_difficulty': by_difficulty,
            })

        return Response(result)

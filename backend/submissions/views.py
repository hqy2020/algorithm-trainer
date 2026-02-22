from rest_framework import viewsets, status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Avg, Count, Q, Min
from django.db.models.functions import TruncDate
from .models import Submission
from .serializers import SubmissionSerializer
from .ai_review import build_ai_feedback


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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_id = serializer.validated_data['user'].id
        problem_id = serializer.validated_data['problem'].id
        is_passed = serializer.validated_data.get('is_passed', False)
        new_time = serializer.validated_data.get('time_spent', 0)

        # 查询历史最佳（仅通过的提交）
        previous_best = Submission.objects.filter(
            user_id=user_id, problem_id=problem_id, is_passed=True
        ).aggregate(best=Min('time_spent'))['best']

        submission = serializer.save()

        ai_feedback = build_ai_feedback(
            problem_number=submission.problem.number,
            problem_title=submission.problem.title,
            problem_difficulty=submission.problem.difficulty,
            problem_category=submission.problem.category,
            problem_description=submission.problem.description,
            code=submission.code,
            is_passed=submission.is_passed,
            test_cases_total=submission.test_cases_total,
            test_cases_passed=submission.test_cases_passed,
            time_spent=submission.time_spent,
            user_feedback=submission.feedback,
        )
        if ai_feedback:
            submission.ai_feedback = ai_feedback
            submission.save(update_fields=['ai_feedback'])

        # 判断是否为新纪录
        is_new_record = False
        is_first_pass = False
        if is_passed:
            if previous_best is None:
                is_new_record = True  # 首次通过
                is_first_pass = True
            elif new_time < previous_best:
                is_new_record = True  # 刷新纪录

        data = self.get_serializer(submission).data
        data['is_new_record'] = is_new_record
        data['is_first_pass'] = is_first_pass
        data['is_record_break'] = is_passed and previous_best is not None and new_time < previous_best
        data['previous_best'] = previous_best

        return Response(data, status=http_status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def personal_best(self, request):
        """获取个人最佳成绩"""
        user_id = request.query_params.get('user')
        problem_id = request.query_params.get('problem')
        if not user_id or not problem_id:
            return Response({'error': '需要 user 和 problem 参数'}, status=http_status.HTTP_400_BAD_REQUEST)

        best = Submission.objects.filter(
            user_id=user_id, problem_id=problem_id, is_passed=True
        ).order_by('time_spent').first()

        if best:
            records = Submission.objects.filter(
                user_id=user_id, problem_id=problem_id, is_passed=True
            ).order_by('created_at').values('id', 'time_spent', 'created_at')
            return Response({
                'has_record': True,
                'best_time': best.time_spent,
                'submission_id': best.id,
                'created_at': best.created_at,
                'records': [
                    {
                        'submission_id': item['id'],
                        'time_spent': item['time_spent'],
                        'created_at': item['created_at'],
                    }
                    for item in records
                ],
            })
        return Response({'has_record': False, 'best_time': None, 'records': []})

    @action(detail=False, methods=['get'])
    def personal_bests(self, request):
        """获取用户所有题目的个人最佳完成时间"""
        user_id = request.query_params.get('user')
        if not user_id:
            return Response({'error': '需要 user 参数'}, status=http_status.HTTP_400_BAD_REQUEST)

        records = Submission.objects.filter(
            user_id=user_id,
            is_passed=True,
        ).values('problem_id').annotate(
            best_time=Min('time_spent'),
            solved_count=Count('id'),
        ).order_by('problem_id')

        return Response({
            'user': int(user_id),
            'records': list(records),
        })

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

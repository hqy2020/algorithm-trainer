import json
import time

from django.db.models import Avg, Count, Q, Min
from django.db.models.functions import TruncDate
from django.http import StreamingHttpResponse
from django.utils import timezone
from problems.models import Problem
from rest_framework import viewsets, status as http_status
from rest_framework.decorators import action, api_view, renderer_classes
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer, BrowsableAPIRenderer

from .models import Submission, DuelTimerState, DuelRoom
from users.models import Profile
from .serializers import SubmissionSerializer
from .ai_review import stream_ai_feedback


def _to_sse_payload(event: dict) -> str:
    return f'data: {json.dumps(event, ensure_ascii=False)}\n\n'


def _serialize_user_status(user_id: int, problem_id: int, local_code_exists: bool = False) -> dict:
    """序列化用户在对战中的状态"""
    latest_submission = Submission.objects.filter(
        user_id=user_id,
        problem_id=problem_id,
    ).order_by('-id').first()

    if not latest_submission:
        status = 'not_started'
        submission_data = None
    elif latest_submission.is_passed:
        status = 'passed'
        submission_data = {
            'is_passed': True,
            'time_spent': latest_submission.time_spent,
            'created_at': latest_submission.created_at.isoformat(),
        }
    else:
        status = 'submitted'
        submission_data = {
            'is_passed': False,
            'time_spent': latest_submission.time_spent,
            'created_at': latest_submission.created_at.isoformat(),
        }

    # 如果有本地代码但未提交，状态为 working
    if local_code_exists and status == 'not_started':
        status = 'working'

    return {
        'id': user_id,
        'status': status,
        'submission': submission_data,
    }


def _serialize_duel_timer_state(state: DuelTimerState, user_a_id: int = None, user_b_id: int = None, problem_id: int = None) -> dict:
    now = timezone.now()
    elapsed_seconds = int(state.elapsed_seconds or 0)
    if state.action == DuelTimerState.ACTION_START and state.running_since:
        delta = int((now - state.running_since).total_seconds())
        if delta > 0:
            elapsed_seconds += delta
    if elapsed_seconds < 0:
        elapsed_seconds = 0

    result = {
        'problem': state.problem_id,
        'action': state.action,
        'elapsed_seconds': elapsed_seconds,
        'version': state.version,
        'updated_at': state.updated_at.isoformat() if state.updated_at else None,
    }

    # 如果有 user_a_id 和 user_b_id，添加双方状态
    if user_a_id is not None and user_b_id is not None and problem_id is not None:
        # version 使用双方最新提交的较大 id，以触发同步
        latest_a = Submission.objects.filter(user_id=user_a_id, problem_id=problem_id).order_by('-id').first()
        latest_b = Submission.objects.filter(user_id=user_b_id, problem_id=problem_id).order_by('-id').first()
        combined_version = max(latest_a.id if latest_a else 0, latest_b.id if latest_b else 0, state.version)
        result['version'] = combined_version
        result['user_a'] = _serialize_user_status(user_a_id, problem_id)
        result['user_b'] = _serialize_user_status(user_b_id, problem_id)

    return result


def _default_duel_timer_state(problem_id: int) -> dict:
    return {
        'problem': problem_id,
        'action': DuelTimerState.ACTION_RESET,
        'elapsed_seconds': 0,
        'version': 0,
        'updated_at': None,
    }


class SubmissionViewSet(viewsets.ModelViewSet):
    queryset = Submission.objects.select_related('user', 'problem')
    serializer_class = SubmissionSerializer
    filterset_fields = ['user', 'problem', 'is_passed', 'is_code_only']

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
        is_code_only = serializer.validated_data.get('is_code_only', False)
        new_time = 0 if is_code_only else serializer.validated_data.get('time_spent', 0)

        # 查询历史最佳（仅通过的提交）
        previous_best = Submission.objects.filter(
            user_id=user_id, problem_id=problem_id, is_passed=True, is_code_only=False
        ).aggregate(best=Min('time_spent'))['best']

        # 这些字段不再由前端手填；保持后端统一默认值。
        submission = serializer.save(
            time_spent=0 if is_code_only else new_time,
            test_cases_total=0,
            test_cases_passed=0,
            feedback='',
        )

        # 判断是否为新纪录
        is_new_record = False
        is_first_pass = False
        if is_passed and not is_code_only:
            if previous_best is None:
                is_new_record = True  # 首次通过
                is_first_pass = True
            elif new_time < previous_best:
                is_new_record = True  # 刷新纪录

        data = self.get_serializer(submission).data
        data['is_new_record'] = is_new_record
        data['is_first_pass'] = is_first_pass
        data['is_record_break'] = is_passed and not is_code_only and previous_best is not None and new_time < previous_best
        data['previous_best'] = previous_best

        return Response(data, status=http_status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def ai_review_stream(self, request, pk=None):
        submission = self.get_object()

        def event_stream():
            try:
                if submission.is_code_only:
                    yield _to_sse_payload({
                        'type': 'done',
                        'text': '本次为仅提交代码，不触发 AI 评估。',
                        'usage': {
                            'prompt_tokens': None,
                            'completion_tokens': None,
                            'total_tokens': None,
                        },
                    })
                    return

                if (submission.ai_feedback or '').strip():
                    yield _to_sse_payload({
                        'type': 'done',
                        'text': submission.ai_feedback,
                        'usage': {
                            'prompt_tokens': None,
                            'completion_tokens': None,
                            'total_tokens': None,
                        },
                    })
                    return

                for event in stream_ai_feedback(
                    problem_number=submission.problem.number,
                    problem_title=submission.problem.title,
                    problem_difficulty=submission.problem.difficulty,
                    problem_category=submission.problem.category,
                    problem_description=submission.problem.description,
                    code=submission.code,
                    is_passed=submission.is_passed,
                    time_spent=submission.time_spent,
                ):
                    if event.get('type') == 'done':
                        final_text = (event.get('text') or '').strip()
                        if final_text:
                            submission.ai_feedback = final_text
                            submission.save(update_fields=['ai_feedback'])
                    yield _to_sse_payload(event)
            except Exception:
                yield _to_sse_payload({
                    'type': 'error',
                    'message': 'AI 回评流中断，请稍后重试',
                })

        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    @action(detail=False, methods=['get', 'post'])
    def duel_timer_state(self, request):
        problem_id = request.query_params.get('problem') or request.data.get('problem')
        if not problem_id:
            return Response({'error': '需要 problem 参数'}, status=http_status.HTTP_400_BAD_REQUEST)

        try:
            problem_id_int = int(problem_id)
        except (TypeError, ValueError):
            return Response({'error': 'problem 参数非法'}, status=http_status.HTTP_400_BAD_REQUEST)
        if not Problem.objects.filter(id=problem_id_int).exists():
            return Response({'error': 'problem 不存在'}, status=http_status.HTTP_400_BAD_REQUEST)

        if request.method.lower() == 'get':
            state = DuelTimerState.objects.filter(problem_id=problem_id_int).first()
            if not state:
                return Response(_default_duel_timer_state(problem_id_int))
            return Response(_serialize_duel_timer_state(state))

        action_value = (request.data.get('action') or '').strip()
        valid_actions = {
            DuelTimerState.ACTION_START,
            DuelTimerState.ACTION_PAUSE,
            DuelTimerState.ACTION_RESET,
        }
        if action_value not in valid_actions:
            return Response({'error': 'action 参数非法'}, status=http_status.HTTP_400_BAD_REQUEST)

        state, created = DuelTimerState.objects.get_or_create(
            problem_id=problem_id_int,
            defaults={
                'action': DuelTimerState.ACTION_RESET,
                'elapsed_seconds': 0,
                'running_since': None,
                'version': 0,
            },
        )
        now = timezone.now()
        changed = False

        if action_value == DuelTimerState.ACTION_START:
            if state.action != DuelTimerState.ACTION_START:
                state.action = DuelTimerState.ACTION_START
                state.running_since = now
                changed = True
        elif action_value == DuelTimerState.ACTION_PAUSE:
            if state.action == DuelTimerState.ACTION_START and state.running_since:
                delta = int((now - state.running_since).total_seconds())
                state.elapsed_seconds = int(state.elapsed_seconds or 0) + max(delta, 0)
                state.running_since = None
                changed = True
            if state.action != DuelTimerState.ACTION_PAUSE:
                state.action = DuelTimerState.ACTION_PAUSE
                changed = True
        elif action_value == DuelTimerState.ACTION_RESET:
            if state.action != DuelTimerState.ACTION_RESET or state.elapsed_seconds != 0 or state.running_since is not None:
                state.action = DuelTimerState.ACTION_RESET
                state.elapsed_seconds = 0
                state.running_since = None
                changed = True

        if changed:
            state.version += 1
            state.save(update_fields=['action', 'elapsed_seconds', 'running_since', 'version', 'updated_at'])

        return Response(_serialize_duel_timer_state(state))

    @action(detail=False, methods=['get'])
    def duel_timer_stream(self, request):
        problem_id = request.query_params.get('problem')
        user_a_id = request.query_params.get('user_a')
        user_b_id = request.query_params.get('user_b')

        if not problem_id:
            return Response({'error': '需要 problem 参数'}, status=http_status.HTTP_400_BAD_REQUEST)

        try:
            problem_id_int = int(problem_id)
        except (TypeError, ValueError):
            return Response({'error': 'problem 参数非法'}, status=http_status.HTTP_400_BAD_REQUEST)
        if not Problem.objects.filter(id=problem_id_int).exists():
            return Response({'error': 'problem 不存在'}, status=http_status.HTTP_400_BAD_REQUEST)

        # 解析 user_a 和 user_b 参数（可选）
        user_a_id_int = None
        user_b_id_int = None
        if user_a_id:
            try:
                user_a_id_int = int(user_a_id)
            except (TypeError, ValueError):
                pass
        if user_b_id:
            try:
                user_b_id_int = int(user_b_id)
            except (TypeError, ValueError):
                pass

        has_user_params = user_a_id_int is not None and user_b_id_int is not None

        def event_stream():
            last_version = None
            next_ping_at = time.monotonic() + 15
            try:
                while True:
                    state = DuelTimerState.objects.filter(problem_id=problem_id_int).first()
                    if has_user_params:
                        payload = _serialize_duel_timer_state(
                            state, user_a_id_int, user_b_id_int, problem_id_int
                        ) if state else _default_duel_timer_state(problem_id_int)
                    else:
                        payload = _serialize_duel_timer_state(state) if state else _default_duel_timer_state(problem_id_int)
                    version = payload.get('version')

                    should_emit = last_version is None or version != last_version

                    if should_emit:
                        yield _to_sse_payload(payload)
                        last_version = version
                        next_ping_at = time.monotonic() + 15
                    else:
                        now = time.monotonic()
                        if now >= next_ping_at:
                            # 注释心跳，避免代理或浏览器长连接超时断开。
                            yield ': ping\n\n'
                            next_ping_at = now + 15

                    time.sleep(0.35)
            except GeneratorExit:
                return

        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    @action(detail=False, methods=['get'])
    def latest(self, request):
        user_id = request.query_params.get('user')
        problem_id = request.query_params.get('problem')
        if not user_id or not problem_id:
            return Response({'error': '需要 user 和 problem 参数'}, status=http_status.HTTP_400_BAD_REQUEST)

        try:
            user_id_int = int(user_id)
            problem_id_int = int(problem_id)
        except (TypeError, ValueError):
            return Response({'error': 'user 或 problem 参数非法'}, status=http_status.HTTP_400_BAD_REQUEST)

        latest_submission = Submission.objects.filter(
            user_id=user_id_int,
            problem_id=problem_id_int,
        ).order_by('-id').first()

        if not latest_submission:
            return Response({
                'user': user_id_int,
                'problem': problem_id_int,
                'version': 0,
                'has_submission': False,
                'submission': None,
            })

        return Response({
            'user': user_id_int,
            'problem': problem_id_int,
            'version': latest_submission.id,
            'has_submission': True,
            'submission': {
                'id': latest_submission.id,
                'is_passed': latest_submission.is_passed,
                'is_code_only': latest_submission.is_code_only,
                'time_spent': latest_submission.time_spent,
                'created_at': latest_submission.created_at,
            },
        })

    @action(detail=False, methods=['get'])
    def personal_best(self, request):
        """获取个人最佳成绩"""
        user_id = request.query_params.get('user')
        problem_id = request.query_params.get('problem')
        if not user_id or not problem_id:
            return Response({'error': '需要 user 和 problem 参数'}, status=http_status.HTTP_400_BAD_REQUEST)

        best = Submission.objects.filter(
            user_id=user_id, problem_id=problem_id, is_passed=True, is_code_only=False
        ).order_by('time_spent').first()

        if best:
            records = Submission.objects.filter(
                user_id=user_id, problem_id=problem_id, is_passed=True, is_code_only=False
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
            is_code_only=False,
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
        qs = qs.filter(is_code_only=False)
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
            qs = Submission.objects.filter(user=profile, is_code_only=False)
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


# ===== 房间管理 API =====

@api_view(['POST'])
def create_room(request):
    """创建对战房间"""
    user_id = request.data.get('user')
    problem_id = request.data.get('problem')

    if not user_id or not problem_id:
        return Response({'error': '需要 user 和 problem 参数'}, status=http_status.HTTP_400_BAD_REQUEST)

    try:
        user_id_int = int(user_id)
        problem_id_int = int(problem_id)
    except (TypeError, ValueError):
        return Response({'error': 'user 或 problem 参数非法'}, status=http_status.HTTP_400_BAD_REQUEST)

    user = Profile.objects.filter(id=user_id_int).first()
    problem = Problem.objects.filter(id=problem_id_int).first()

    if not user:
        return Response({'error': '用户不存在'}, status=http_status.HTTP_400_BAD_REQUEST)
    if not problem:
        return Response({'error': '题目不存在'}, status=http_status.HTTP_400_BAD_REQUEST)

    try:
        room_code = DuelRoom.generate_room_code()
        room = DuelRoom.objects.create(
            room_code=room_code,
            problem=problem,
            user_a=user,
            status=DuelRoom.STATUS_WAITING,
        )
        return Response({
            'room_code': room.room_code,
            'problem': {
                'id': problem.id,
                'number': problem.number,
                'title': problem.title,
                'difficulty': problem.difficulty,
            },
            'user_a': {
                'id': user.id,
                'name': user.name,
                'color': user.color,
            },
            'user_b': None,
            'status': room.status,
            'stream_url': f'/api/rooms/{room_code}/stream/',
        }, status=http_status.HTTP_201_CREATED)
    except ValueError as e:
        return Response({'error': str(e)}, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET', 'POST'])
def room_detail(request, code: str):
    """获取房间详情或加入房间"""
    room = DuelRoom.objects.filter(room_code=code).first()
    if not room:
        return Response({'error': '房间不存在'}, status=http_status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        # 返回房间信息
        user_b_data = None
        if room.user_b:
            user_b_data = {
                'id': room.user_b.id,
                'name': room.user_b.name,
                'color': room.user_b.color,
            }
        return Response({
            'room_code': room.room_code,
            'problem': {
                'id': room.problem.id,
                'number': room.problem.number,
                'title': room.problem.title,
                'difficulty': room.problem.difficulty,
            },
            'user_a': {
                'id': room.user_a.id,
                'name': room.user_a.name,
                'color': room.user_a.color,
            },
            'user_b': user_b_data,
            'status': room.status,
            'stream_url': f'/api/rooms/{room.room_code}/stream/',
        })

    # POST: 加入房间
    user_id = request.data.get('user')
    if not user_id:
        return Response({'error': '需要 user 参数'}, status=http_status.HTTP_400_BAD_REQUEST)

    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        return Response({'error': 'user 参数非法'}, status=http_status.HTTP_400_BAD_REQUEST)

    user = Profile.objects.filter(id=user_id_int).first()
    if not user:
        return Response({'error': '用户不存在'}, status=http_status.HTTP_400_BAD_REQUEST)

    # 检查用户是否已经是房间成员
    if room.user_a.id == user.id:
        return Response({'error': '您已经是房间成员'}, status=http_status.HTTP_400_BAD_REQUEST)

    if room.user_b:
        return Response({'error': '房间已满'}, status=http_status.HTTP_400_BAD_REQUEST)

    if room.status == DuelRoom.STATUS_FINISHED:
        return Response({'error': '房间已结束'}, status=http_status.HTTP_400_BAD_REQUEST)

    # 加入房间
    room.user_b = user
    room.status = DuelRoom.STATUS_ACTIVE
    room.save(update_fields=['user_b', 'status', 'updated_at'])

    return Response({
        'room_code': room.room_code,
        'problem': {
            'id': room.problem.id,
            'number': room.problem.number,
            'title': room.problem.title,
            'difficulty': room.problem.difficulty,
        },
        'user_a': {
            'id': room.user_a.id,
            'name': room.user_a.name,
            'color': room.user_a.color,
        },
        'user_b': {
            'id': user.id,
            'name': user.name,
            'color': user.color,
        },
        'status': room.status,
        'stream_url': f'/api/rooms/{room.room_code}/stream/',
    })


def room_stream(request, code: str):
    """房间实时同步SSE流"""
    room = DuelRoom.objects.filter(room_code=code).first()
    if not room:
        return Response({'error': '房间不存在'}, status=http_status.HTTP_404_NOT_FOUND)

    user_a_id = room.user_a_id
    user_b_id = room.user_b_id
    problem_id = room.problem_id

    def event_stream():
        last_status = None
        last_timer_version = None
        last_submission_a_id = None
        last_submission_b_id = None
        next_ping_at = time.monotonic() + 15
        try:
            while True:
                # 刷新房间状态
                room = DuelRoom.objects.filter(room_code=code).first()
                if not room:
                    yield _to_sse_payload({'type': 'error', 'message': '房间已关闭'})
                    return

                # 获取计时器状态
                timer_state = DuelTimerState.objects.filter(problem_id=problem_id).first()
                timer_data = _serialize_duel_timer_state(
                    timer_state, user_a_id, user_b_id, problem_id
                ) if timer_state else _default_duel_timer_state(problem_id)

                # 获取双方最新提交
                latest_a = Submission.objects.filter(
                    user_id=user_a_id, problem_id=problem_id
                ).order_by('-id').first()
                latest_b = Submission.objects.filter(
                    user_id=user_b_id, problem_id=problem_id
                ).order_by('-id').first() if user_b_id else None

                # 检查是否有变化
                has_changes = (
                    last_status != room.status or
                    last_timer_version != timer_data.get('version') or
                    last_submission_a_id != (latest_a.id if latest_a else 0) or
                    last_submission_b_id != (latest_b.id if latest_b else 0)
                )

                if has_changes:
                    last_status = room.status
                    last_timer_version = timer_data.get('version')
                    last_submission_a_id = latest_a.id if latest_a else 0
                    last_submission_b_id = latest_b.id if latest_b else 0

                    user_a_status = _serialize_user_status(user_a_id, problem_id)
                    user_b_status = _serialize_user_status(user_b_id, problem_id) if user_b_id else None

                    yield _to_sse_payload({
                        'type': 'update',
                        'room_code': room.room_code,
                        'status': room.status,
                        'timer': timer_data,
                        'user_a': user_a_status,
                        'user_b': user_b_status,
                    })
                    next_ping_at = time.monotonic() + 15
                else:
                    now = time.monotonic()
                    if now >= next_ping_at:
                        yield ': ping\n\n'
                        next_ping_at = now + 15

                time.sleep(0.5)
        except GeneratorExit:
            return

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response

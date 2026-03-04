from django.db import models
from django.core.exceptions import ValidationError
from users.models import Profile
from problems.models import Problem


class Submission(models.Model):
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='submissions', verbose_name='用户')
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE, related_name='submissions', verbose_name='题目')
    code = models.TextField(verbose_name='提交代码')
    is_code_only = models.BooleanField(default=False, verbose_name='仅提交代码(不计时)')
    time_spent = models.IntegerField(verbose_name='用时(秒)')
    is_passed = models.BooleanField(default=False, verbose_name='是否通过')
    test_cases_total = models.IntegerField(default=0, verbose_name='总测试用例')
    test_cases_passed = models.IntegerField(default=0, verbose_name='通过用例数')
    feedback = models.TextField(blank=True, verbose_name='反馈/优化建议')
    ai_feedback = models.TextField(blank=True, verbose_name='AI 反馈')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '提交记录'
        verbose_name_plural = '提交记录'
        ordering = ['-created_at']

    def __str__(self):
        status = '✓' if self.is_passed else '✗'
        return f'{self.user.name} - {self.problem} [{status}]'

    @property
    def time_rating(self):
        """根据题目难度和用时给出评价"""
        minutes = self.time_spent / 60
        difficulty = self.problem.difficulty
        thresholds = {
            'Easy': (10, 15),
            'Medium': (15, 25),
            'Hard': (25, 40),
        }
        excellent, passing = thresholds.get(difficulty, (15, 25))
        if minutes <= excellent:
            return 'excellent'
        elif minutes <= passing:
            return 'passing'
        return 'needs_improvement'


class DuelRoom(models.Model):
    """对战房间，通过4位数字room_code邀请同局域网用户加入"""
    STATUS_WAITING = 'waiting'
    STATUS_ACTIVE = 'active'
    STATUS_FINISHED = 'finished'
    STATUS_CHOICES = [
        (STATUS_WAITING, '等待加入'),
        (STATUS_ACTIVE, '进行中'),
        (STATUS_FINISHED, '已完成'),
    ]

    room_code = models.CharField(max_length=4, unique=True, verbose_name='房间号(4位)')
    problem = models.ForeignKey(
        Problem,
        on_delete=models.CASCADE,
        related_name='duel_rooms',
        verbose_name='题目',
    )
    user_a = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='duel_rooms_as_a',
        verbose_name='用户A(创建者)',
    )
    user_b = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name='duel_rooms_as_b',
        null=True,
        blank=True,
        verbose_name='用户B(加入者)',
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_WAITING,
        verbose_name='房间状态',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '对战房间'
        verbose_name_plural = '对战房间'

    def __str__(self):
        return f'房间 {self.room_code} - {self.problem} ({self.get_status_display()})'

    @classmethod
    def generate_room_code(cls) -> str:
        """生成唯一的4位数字房间号"""
        import random
        for _ in range(100):
            code = f'{random.randint(0, 9999):04d}'
            if not cls.objects.filter(room_code=code).exists():
                return code
        raise ValueError('无法生成唯一房间号')


class DuelTimerState(models.Model):
    ACTION_START = 'start'
    ACTION_PAUSE = 'pause'
    ACTION_RESET = 'reset'
    ACTION_CHOICES = [
        (ACTION_START, '开始'),
        (ACTION_PAUSE, '暂停'),
        (ACTION_RESET, '重置'),
    ]

    problem = models.OneToOneField(
        Problem,
        on_delete=models.CASCADE,
        related_name='duel_timer_state',
        verbose_name='题目',
    )
    action = models.CharField(max_length=10, choices=ACTION_CHOICES, default=ACTION_RESET, verbose_name='计时动作')
    elapsed_seconds = models.PositiveIntegerField(default=0, verbose_name='已用秒数')
    running_since = models.DateTimeField(null=True, blank=True, verbose_name='开始时间戳')
    version = models.PositiveIntegerField(default=0, verbose_name='版本号')
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '对战计时状态'
        verbose_name_plural = '对战计时状态'

    def __str__(self):
        return f'{self.problem} - {self.action} v{self.version}'


class AIReviewPrompt(models.Model):
    RESULT_PASSED = 'passed'
    RESULT_FAILED = 'failed'
    RESULT_CHOICES = [
        (RESULT_PASSED, '通过后优化建议'),
        (RESULT_FAILED, '未通过纠错建议'),
    ]

    result_type = models.CharField(
        max_length=10,
        choices=RESULT_CHOICES,
        unique=True,
        verbose_name='提交结果类型',
    )
    prompt = models.TextField(verbose_name='提示词模板')
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'AI 评估提示词'
        verbose_name_plural = 'AI 评估提示词'

    def __str__(self):
        return dict(self.RESULT_CHOICES).get(self.result_type, self.result_type)


class AIProviderConfig(models.Model):
    provider_name = models.CharField(
        max_length=100,
        default='modelverse-openai-compatible',
        verbose_name='提供方名称',
    )
    api_base_url = models.URLField(
        default='https://api.modelverse.cn/v1',
        verbose_name='API Base URL',
    )
    api_key = models.TextField(blank=True, verbose_name='API Key（明文）')
    model_name = models.CharField(
        max_length=100,
        default='gpt-5.1-codex-mini',
        verbose_name='模型名称',
    )
    timeout_seconds = models.PositiveIntegerField(default=45, verbose_name='超时秒数')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'AI Provider 配置'
        verbose_name_plural = 'AI Provider 配置'

    def clean(self):
        if not self.pk and AIProviderConfig.objects.exists():
            raise ValidationError('仅允许一条 AI Provider 配置')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.provider_name

from django.db import models
from users.models import Profile
from problems.models import Problem


class Submission(models.Model):
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='submissions', verbose_name='用户')
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE, related_name='submissions', verbose_name='题目')
    code = models.TextField(verbose_name='提交代码')
    time_spent = models.IntegerField(verbose_name='用时(秒)')
    is_passed = models.BooleanField(default=False, verbose_name='是否通过')
    test_cases_total = models.IntegerField(default=0, verbose_name='总测试用例')
    test_cases_passed = models.IntegerField(default=0, verbose_name='通过用例数')
    feedback = models.TextField(blank=True, verbose_name='反馈/优化建议')
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

from django.db import models
from users.models import Profile
from problems.models import Problem


class Note(models.Model):
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='notes', verbose_name='用户')
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE, related_name='notes', verbose_name='题目')
    content = models.TextField(verbose_name='笔记内容')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '笔记'
        verbose_name_plural = '笔记'
        unique_together = ('user', 'problem')

    def __str__(self):
        return f'{self.user.name} - {self.problem}'

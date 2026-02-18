from django.db import models


class Problem(models.Model):
    DIFFICULTY_CHOICES = [
        ('Easy', '简单'),
        ('Medium', '中等'),
        ('Hard', '困难'),
    ]

    number = models.IntegerField(unique=True, verbose_name='LeetCode 题号')
    title = models.CharField(max_length=200, verbose_name='题目名称')
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, verbose_name='难度')
    category = models.CharField(max_length=50, verbose_name='分类')
    description = models.TextField(blank=True, verbose_name='题目描述')
    solution_code = models.TextField(blank=True, verbose_name='Java 参考答案')
    solution_explanation = models.TextField(blank=True, verbose_name='解题思路')
    leetcode_url = models.URLField(blank=True, verbose_name='LeetCode 链接')
    time_standard = models.IntegerField(default=20, verbose_name='建议用时(分钟)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '题目'
        verbose_name_plural = '题目'
        ordering = ['number']

    def __str__(self):
        return f'{self.number}. {self.title}'

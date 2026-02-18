from django.db import models


class Profile(models.Model):
    name = models.CharField(max_length=50, verbose_name='显示名称')
    color = models.CharField(max_length=7, default='#1890ff', verbose_name='标识色')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '用户档案'
        verbose_name_plural = '用户档案'

    def __str__(self):
        return self.name

from django.core.management.base import BaseCommand
from users.models import Profile


class Command(BaseCommand):
    help = '初始化默认用户'

    def handle(self, *args, **options):
        defaults = [
            ('启云', '#1890ff'),
            ('搭档', '#f5222d'),
        ]
        for name, color in defaults:
            _, created = Profile.objects.get_or_create(
                name=name,
                defaults={'color': color}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'创建用户: {name}'))
            else:
                self.stdout.write(f'用户已存在: {name}')

from django.core.management.base import BaseCommand
from users.models import Profile


class Command(BaseCommand):
    help = '初始化默认用户（需要 --force 才会执行）'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='强制创建默认用户')

    def handle(self, *args, **options):
        if not options['force']:
            self.stdout.write('跳过用户初始化（使用 --force 强制创建）')
            return
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

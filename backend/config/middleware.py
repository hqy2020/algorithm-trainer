from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.db import IntegrityError, transaction


class AdminAutoLoginMiddleware:
    """
    在本地开发环境下，访问 /admin 时自动登录超管账号。
    若系统中还没有超管，会自动创建一个不可密码登录的超管。
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if getattr(settings, 'ADMIN_AUTO_LOGIN', False):
            self._ensure_admin_login(request)
        return self.get_response(request)

    def _ensure_admin_login(self, request):
        if not request.path.startswith('/admin'):
            return

        user = getattr(request, 'user', None)
        if user and user.is_authenticated and user.is_staff:
            return

        admin_user = self._get_or_create_superuser()
        if not admin_user:
            return

        login(request, admin_user, backend='django.contrib.auth.backends.ModelBackend')

    @staticmethod
    def _get_or_create_superuser():
        user_model = get_user_model()

        existed = user_model.objects.filter(is_active=True, is_superuser=True).order_by('id').first()
        if existed:
            return existed

        base_username = (getattr(settings, 'ADMIN_AUTO_LOGIN_USERNAME', '') or 'autoadmin').strip()
        username = base_username
        suffix = 1

        while True:
            row = user_model.objects.filter(username=username).first()
            if not row:
                break
            if row.is_active and row.is_superuser:
                return row
            username = f'{base_username}{suffix}'
            suffix += 1

        try:
            with transaction.atomic():
                existed = (
                    user_model.objects
                    .select_for_update()
                    .filter(is_active=True, is_superuser=True)
                    .order_by('id')
                    .first()
                )
                if existed:
                    return existed

                user = user_model(username=username, is_staff=True, is_superuser=True, is_active=True)
                user.set_unusable_password()
                user.save()
                return user
        except IntegrityError:
            return user_model.objects.filter(is_active=True, is_superuser=True).order_by('id').first()


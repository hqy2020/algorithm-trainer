import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-algorithm-trainer-local-dev-key'

DEBUG = True

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'users',
    'problems',
    'submissions',
    'notes',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'config.middleware.AdminAutoLoginMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.getenv('DB_PATH', '/data/db.sqlite3'),
    }
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = 'zh-hans'
TIME_ZONE = 'Asia/Shanghai'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS
CORS_ALLOW_ALL_ORIGINS = True

# DRF
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
}

# AI 评估（OpenAI 兼容 API）
AI_API_BASE_URL = os.getenv('AI_API_BASE_URL', 'https://api.modelverse.cn/v1')
AI_API_KEY = os.getenv('AI_API_KEY', '').strip()
AI_API_MODEL = os.getenv('AI_API_MODEL', 'gpt-5.1-codex-mini')
AI_API_TIMEOUT_SECONDS = int(os.getenv('AI_API_TIMEOUT_SECONDS', '45'))

# 启动时检查 AI API 配置
if not AI_API_KEY:
    import warnings
    warnings.warn(
        'AI_API_KEY 环境变量未配置，AI 代码评审功能将不可用。'
        '请在 .env 或 docker-compose.yml 中设置 AI_API_KEY。'
    )

# Django Admin 免密自动登录（默认开启）
ADMIN_AUTO_LOGIN = os.getenv('ADMIN_AUTO_LOGIN', '1').strip().lower() in ('1', 'true', 'yes', 'on')
ADMIN_AUTO_LOGIN_USERNAME = os.getenv('ADMIN_AUTO_LOGIN_USERNAME', 'autoadmin').strip() or 'autoadmin'

# 前端地址（用于后端根路径跳转）
# 为空时，后端会按请求主机动态跳转到 http(s)://<当前主机>:FRONTEND_PORT。
FRONTEND_URL = os.getenv('FRONTEND_URL', '').strip()
FRONTEND_PORT = int(os.getenv('FRONTEND_PORT', '10000'))

import json
import logging
from typing import Any, Dict
from urllib import error, request

from django.conf import settings

from .models import AIReviewPrompt, AIProviderConfig

logger = logging.getLogger(__name__)


DEFAULT_PROMPTS = {
    AIReviewPrompt.RESULT_PASSED: (
        "你是资深算法面试官。用户这次提交已经通过。请只给“可执行的优化建议”，"
        "重点关注：时间复杂度、空间复杂度、边界条件、代码可读性。"
        "输出要求：\n"
        "1. 先给一句总体评价\n"
        "2. 再给 3 条以内优化建议（每条包含“为什么 + 如何改”）\n"
        "3. 如果当前实现已足够优秀，明确说明“当前实现已接近最优”并给 1 条微优化建议"
    ),
    AIReviewPrompt.RESULT_FAILED: (
        "你是资深算法面试官。用户这次提交未通过。请根据题目信息与通过情况定位错误原因，"
        "给出可执行的修复方案。输出要求：\n"
        "1. 先指出最可能的核心错误（1-2 条）\n"
        "2. 给出修复步骤（分点，按先后顺序）\n"
        "3. 列出 2-3 个针对性的测试用例，帮助用户自测修复是否生效\n"
        "4. 语气直接、简洁，避免空泛鼓励"
    ),
}


def _load_provider_runtime_config() -> Dict[str, Any]:
    config = AIProviderConfig.objects.filter(is_active=True).order_by('-updated_at', '-id').first()

    base_url = settings.AI_API_BASE_URL
    api_key = settings.AI_API_KEY
    model_name = settings.AI_API_MODEL
    timeout_seconds = settings.AI_API_TIMEOUT_SECONDS

    if config:
        base_url = (config.api_base_url or '').strip() or base_url
        api_key = (config.api_key or '').strip() or api_key
        model_name = (config.model_name or '').strip() or model_name
        timeout_seconds = config.timeout_seconds or timeout_seconds

    return {
        'base_url': base_url.rstrip('/'),
        'api_key': api_key.strip(),
        'model_name': model_name.strip(),
        'timeout_seconds': int(timeout_seconds),
    }


def _api_post(*, path: str, payload: Dict[str, Any], base_url: str, api_key: str, timeout_seconds: int) -> Dict[str, Any]:
    url = f'{base_url}{path}'

    req = request.Request(
        url=url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
        },
        method='POST',
    )
    with request.urlopen(req, timeout=timeout_seconds) as resp:
        return json.loads(resp.read().decode('utf-8'))


def _extract_responses_text(result: Dict[str, Any]) -> str:
    output_text = result.get('output_text')
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    chunks = []
    for item in result.get('output', []) or []:
        for content in item.get('content', []) or []:
            text = content.get('text')
            if isinstance(text, str) and text.strip():
                chunks.append(text.strip())
    return '\n'.join(chunks).strip()


def _extract_chat_text(result: Dict[str, Any]) -> str:
    choices = result.get('choices', []) or []
    if not choices:
        return ''
    message = (choices[0] or {}).get('message') or {}
    content = message.get('content')
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        chunks = []
        for item in content:
            text = item.get('text') if isinstance(item, dict) else None
            if isinstance(text, str) and text.strip():
                chunks.append(text.strip())
        return '\n'.join(chunks).strip()
    return ''


def _get_prompt(result_type: str) -> str:
    prompt_obj = AIReviewPrompt.objects.filter(result_type=result_type).first()
    if prompt_obj and prompt_obj.prompt.strip():
        return prompt_obj.prompt.strip()
    return DEFAULT_PROMPTS[result_type]


def build_ai_feedback(
    *,
    problem_number: int,
    problem_title: str,
    problem_difficulty: str,
    problem_category: str,
    problem_description: str,
    code: str,
    is_passed: bool,
    test_cases_total: int,
    test_cases_passed: int,
    time_spent: int,
    user_feedback: str,
) -> str:
    runtime_config = _load_provider_runtime_config()
    if not runtime_config['api_key']:
        logger.warning('AI 回评已跳过：未配置 API key')
        return ''

    result_type = AIReviewPrompt.RESULT_PASSED if is_passed else AIReviewPrompt.RESULT_FAILED
    system_prompt = _get_prompt(result_type)
    user_message = (
        f'题目：{problem_number}. {problem_title}\n'
        f'难度：{problem_difficulty}\n'
        f'分类：{problem_category}\n'
        f'提交结果：{"通过" if is_passed else "未通过"}\n'
        f'用时（秒）：{time_spent}\n'
        f'测试用例：{test_cases_passed}/{test_cases_total}\n\n'
        f'题目描述：\n{problem_description or "（暂无）"}\n\n'
        f'用户代码：\n{code}\n\n'
        f'用户补充说明：\n{user_feedback or "（无）"}'
    )

    try:
        responses_payload = {
            'model': runtime_config['model_name'],
            'input': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_message},
            ],
        }
        responses_result = _api_post(
            path='/responses',
            payload=responses_payload,
            base_url=runtime_config['base_url'],
            api_key=runtime_config['api_key'],
            timeout_seconds=runtime_config['timeout_seconds'],
        )
        text = _extract_responses_text(responses_result)
        if text:
            return text
    except error.HTTPError as exc:
        # 一些兼容实现对 /responses 支持不完整，统一降级到 /chat/completions。
        logger.warning('AI responses API 调用失败(code=%s): %s，准备降级 /chat/completions', exc.code, exc)
    except Exception as exc:  # pragma: no cover - 外部网络异常
        logger.warning('AI responses API 调用失败: %s，准备降级 /chat/completions', exc)

    try:
        chat_payload = {
            'model': runtime_config['model_name'],
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_message},
            ],
        }
        chat_result = _api_post(
            path='/chat/completions',
            payload=chat_payload,
            base_url=runtime_config['base_url'],
            api_key=runtime_config['api_key'],
            timeout_seconds=runtime_config['timeout_seconds'],
        )
        return _extract_chat_text(chat_result)
    except Exception as exc:  # pragma: no cover - 外部网络异常
        logger.warning('AI chat completions 调用失败: %s', exc)
        return ''

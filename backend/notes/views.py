from rest_framework import viewsets
from rest_framework.response import Response
from .models import Note
from .serializers import NoteSerializer


class NoteViewSet(viewsets.ModelViewSet):
    queryset = Note.objects.select_related('user', 'problem')
    serializer_class = NoteSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user_id = self.request.query_params.get('user')
        problem_id = self.request.query_params.get('problem')
        if user_id:
            qs = qs.filter(user_id=user_id)
        if problem_id:
            qs = qs.filter(problem_id=problem_id)
        return qs

    def create(self, request, *args, **kwargs):
        """创建或更新笔记（upsert）"""
        user_id = request.data.get('user')
        problem_id = request.data.get('problem')
        content = request.data.get('content', '')

        note, created = Note.objects.update_or_create(
            user_id=user_id,
            problem_id=problem_id,
            defaults={'content': content}
        )
        serializer = self.get_serializer(note)
        return Response(serializer.data, status=201 if created else 200)

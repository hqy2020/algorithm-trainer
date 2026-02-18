from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Problem
from .serializers import ProblemSerializer, ProblemListSerializer


class ProblemViewSet(viewsets.ModelViewSet):
    queryset = Problem.objects.all()
    serializer_class = ProblemSerializer

    def get_serializer_class(self):
        if self.action == 'list':
            return ProblemListSerializer
        return ProblemSerializer

    @action(detail=True, methods=['get'])
    def solution(self, request, pk=None):
        """单独获取参考答案"""
        problem = self.get_object()
        return Response({
            'solution_code': problem.solution_code,
            'solution_explanation': problem.solution_explanation,
        })

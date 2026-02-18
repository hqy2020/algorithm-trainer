from rest_framework import serializers
from .models import Problem


class ProblemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Problem
        fields = '__all__'


class ProblemListSerializer(serializers.ModelSerializer):
    """列表页用的精简序列化器，不返回大文本字段"""
    class Meta:
        model = Problem
        exclude = ('description', 'solution_code', 'solution_explanation')

from rest_framework import serializers
from .models import Submission


class SubmissionSerializer(serializers.ModelSerializer):
    time_rating = serializers.ReadOnlyField()
    user_name = serializers.CharField(source='user.name', read_only=True)
    problem_title = serializers.CharField(source='problem.__str__', read_only=True)

    class Meta:
        model = Submission
        fields = '__all__'
        read_only_fields = ('ai_feedback',)

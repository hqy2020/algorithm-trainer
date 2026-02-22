from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from .models import Profile


class ProfileSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        validators=[UniqueValidator(queryset=Profile.objects.all(), message='该用户名已存在')]
    )

    class Meta:
        model = Profile
        fields = '__all__'

#!/bin/bash
set -e

echo "Running migrations..."
python manage.py migrate

echo "Loading Hot 100 problems..."
python manage.py load_hot100

echo "Starting server..."
python manage.py runserver 0.0.0.0:8000

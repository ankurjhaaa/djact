"""
Example: Users CRUD with pagination + validation.

Template: see example/templates/users.html
"""
from django.contrib.auth.models import User
from djact.pagination import paginate
from djact.validation import validate


class Component:
    def mount(self, request):
        return {
            "users": paginate(User.objects.all().order_by("-id"), request, 10),
            "username": "",
            "email": "",
            "editing_id": None,
            "errors": {},
        }

    def save_user(self, request, data):
        # Auto-raises ValidationError → auto-returns errors to frontend
        validate(data, {
            "username": "required|string|min:3|max:150",
            "email": "required|email|max:255",
        })

        # Only runs if validation passes
        username = data["username"].strip()
        email = data["email"].strip()
        editing_id = data.get("editing_id")

        if editing_id:
            user = User.objects.get(id=editing_id)
            user.username = username
            user.email = email
            user.save()
        else:
            User.objects.create_user(username=username, email=email)

        return {
            "users": paginate(User.objects.all().order_by("-id"), request, 10),
            "username": "",
            "email": "",
            "editing_id": None,
            "errors": {},
        }

    def delete_user(self, request, data, user_id):
        User.objects.filter(id=user_id).delete()
        return {"users": paginate(User.objects.all().order_by("-id"), request, 10)}

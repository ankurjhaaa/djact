"""
Example users CRUD component with pagination.

Usage in template:
    <div dj:component="users" dj:state="users=[], username='', email='', editing_id=null, error=''">
        <form dj:submit="save_user">
            <input dj:model="username" placeholder="Username">
            <input dj:model="email" placeholder="Email">
            <button type="submit">Save</button>
        </form>

        <tr dj:for="user in users">
            <td>[[ user.username ]]</td>
            <td>[[ user.email ]]</td>
            <td><button dj:click="delete_user(user.id)">Delete</button></td>
        </tr>

        <p dj:empty="users">No users yet.</p>
        <div dj:paginate="users"></div>
    </div>
"""
from django.contrib.auth.models import User
from djact.pagination import paginate


class Component:
    def mount(self, request):
        users = paginate(User.objects.all().order_by("-id"), request, 10)
        return {
            "users": users,
            "username": "",
            "email": "",
            "editing_id": None,
            "error": "",
        }

    def save_user(self, request, data):
        username = data.get("username", "").strip()
        email = data.get("email", "").strip()
        editing_id = data.get("editing_id")

        if not username:
            return {"error": "Username is required!"}

        if editing_id:
            user = User.objects.get(id=editing_id)
            user.username = username
            user.email = email
            user.save()
        else:
            User.objects.create_user(username=username, email=email)

        users = paginate(User.objects.all().order_by("-id"), request, 10)
        return {
            "users": users,
            "username": "",
            "email": "",
            "editing_id": None,
            "error": "",
        }

    def delete_user(self, request, data, user_id):
        User.objects.filter(id=user_id).delete()
        users = paginate(User.objects.all().order_by("-id"), request, 10)
        return {"users": users}

    def change_page(self, request, data):
        users = paginate(User.objects.all().order_by("-id"), request, 10)
        return {"users": users}

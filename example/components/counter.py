"""
Example counter component.

Usage in template:
    <div dj:component="counter" dj:state="count=0">
        <h1>Count: [[ count ]]</h1>
        <button dj:click="increment">+1</button>
        <button dj:click="decrement">-1</button>
        <button dj:click="reset">Reset</button>
    </div>
"""


class Component:
    def mount(self, request):
        return {"count": 0}

    def increment(self, request, data):
        return {"count": data.get("count", 0) + 1}

    def decrement(self, request, data):
        return {"count": data.get("count", 0) - 1}

    def reset(self, request, data):
        return {"count": 0}

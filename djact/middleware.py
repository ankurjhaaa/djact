from django.http import HttpResponseRedirect
from djact.utils import is_djact_request

class Djact:
    """Helper attached to request.djact to manage shared data."""
    def __init__(self):
        self._shared_data = {}

    def share(self, key, value):
        """Share data with all Djact responses in this request cycle."""
        self._shared_data[key] = value

    def get_shared(self):
        return self._shared_data

class DjactMiddleware:
    """Annotate incoming requests and provide a response-level extension hook.

    Attaches ``request.is_djact`` (``bool``) and ``request.djact`` (shared data helper).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # --- request phase ---
        request.is_djact = is_djact_request(request)
        request.djact = Djact()

        response = self.get_response(request)

        # Handle redirects for Djact requests
        if request.is_djact and isinstance(response, HttpResponseRedirect):
            # Tell the JS engine where we are going
            response['X-Djact-Location'] = response['Location']

        # --- response phase ---
        return self._process_response(request, response)

    # ------------------------------------------------------------------
    # Extension hooks
    # ------------------------------------------------------------------

    def _process_response(self, request, response):
        """Override in a subclass to add response-level Djact logic."""
        return response

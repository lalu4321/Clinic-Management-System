from rest_framework.renderers import JSONRenderer


class StandardizedJSONRenderer(JSONRenderer):

    def render(self, data, accepted_media_type=None, renderer_context=None):

        response = renderer_context.get("response", None)

        if response is None:
            return super().render(data, accepted_media_type, renderer_context)

        status_code = response.status_code

        success = 200 <= status_code < 300

        if success:

            formatted_response = {
                "success": True,
                "message": "Request successful",
                "data": data
            }

        else:

            # The custom exception handler already produces
            # {success, message, errors}.  Avoid double-wrapping by
            # passing that structure through unchanged.
            if isinstance(data, dict) and "success" in data and "errors" in data:
                formatted_response = data
            else:
                formatted_response = {
                    "success": False,
                    "message": "Request failed",
                    "errors": data
                }

        return super().render(
            formatted_response,
            accepted_media_type,
            renderer_context
        )
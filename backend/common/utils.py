from rest_framework.response import Response


def success_response(data=None, message="Request successful", status=200):

    return Response(
        {
            "success": True,
            "message": message,
            "data": data
        },
        status=status
    )
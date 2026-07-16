from django.urls import path
from .views import LiveAppointmentBoardView

urlpatterns = [
    path("live-board/", LiveAppointmentBoardView.as_view(), name="live-board"),
]

from django.urls import path, include
from rest_framework import routers
from . import views

router = routers.DefaultRouter()
router.register(r'simulation', views.SimulationViewSet, basename='simulation')

urlpatterns = [
    path('', views.simulation_page, name='simulation-page'),
    path('api/', include(router.urls)),
]

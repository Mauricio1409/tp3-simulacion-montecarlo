from django.shortcuts import render
from rest_framework.viewsets import ViewSet
from rest_framework.decorators import action
from .service import MueblesService
class SimulationView(ViewSet):

    service = MueblesService()

    # /api/simulation/default
    @action(methods=['get'], detail=False, url_path="defaults")
    def default(self, request):
        pass

    # /api/simulation
    def create(self, request):
        pass


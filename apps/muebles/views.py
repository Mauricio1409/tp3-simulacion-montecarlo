from django.shortcuts import render
from rest_framework.viewsets import ViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from .service import MueblesService


def simulation_page(request):
    """Sirve el HTML que va a hacer fetch contra la API."""
    return render(request, 'muebles/simulation.html')


class SimulationViewSet(ViewSet):
    service = MueblesService()

    # GET /api/simulation/defaults/
    @action(methods=['get'], detail=False, url_path='defaults')
    def defaults(self, request):
        return Response({'ok': True, 'message': 'defaults pendiente'})

    # POST /api/simulation/
    def create(self, request):
        return Response({'ok': True, 'message': 'simulación pendiente'})

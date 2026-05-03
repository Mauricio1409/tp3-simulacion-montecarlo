from django.shortcuts import render
from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from rest_framework import status
from .service import MueblesService


def simulation_page(request):
    return render(request, 'muebles/simulation.html')


class SimulationViewSet(ViewSet):
    service = MueblesService()

    def create(self, request):
        result = self.service.run(request.data)
        return Response(result, status.HTTP_200_OK)

from rest_framework import serializers


class SimulationParamsSerializer(serializers.Serializer):
    n_corridas = serializers.IntegerField(default=1000, min_value=1)
    page = serializers.IntegerField(default=1, min_value=1)
    page_size = serializers.IntegerField(default=100, min_value=1, max_value=500)

    prob_etapa_1 = serializers.FloatField(default=0.20)
    prob_etapa_2 = serializers.FloatField(default=0.50)
    prob_etapa_3 = serializers.FloatField(default=0.30)

    prob_control = serializers.FloatField(default=0.60)
    prob_demora = serializers.FloatField(default=0.40)
    prob_intervencion = serializers.FloatField(default=0.25)

    media_tiempo_etapa = serializers.FloatField(default=5.0)
    desvio_tiempo_etapa = serializers.FloatField(default=2.83)
    media_tiempo_control = serializers.FloatField(default=8.0)
    media_intervencion = serializers.FloatField(default=12.0)
    factor_demora = serializers.FloatField(default=1.8)

    def validate(self, data):
        # validacion de probabilidades etapas
        if abs(data['prob_etapa_1'] + data['prob_etapa_2'] + data['prob_etapa_3'] - 1.0) > 1e-6:
            raise serializers.ValidationError("Las probabilidades de etapa deben sumar 1.")
        # validacion de probabilidaes de control, demora e intervencion
        if data["prob_control"] > 1.0 or data["prob_demora"] > 1.0 or data["prob_intervencion"] > 1.0:
            raise serializers.ValidationError("Las probabilidades de control, demora e intervencion deben ser menores o iguales a 1.")

        # validacion de factor de demora que tiene que ser mayor a 0
        if data["factor_demora"] <= 0:
            raise serializers.ValidationError("El factor de demora debe ser mayor a 0.")

        # validacion de pagina y page_size en relacion a n_corridas
        page = data['page']
        page_size = data['page_size']
        n = data['n_corridas']
        offset = (page - 1) * page_size
        if offset >= n:
            raise serializers.ValidationError(
                f"La página {page} con page_size {page_size} excede n_corridas={n}."
            )
        return data




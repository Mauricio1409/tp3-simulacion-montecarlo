import math
import random
from apps.muebles.serializers import SimulationParamsSerializer, WINDOW_SIZE

class MueblesService:

    def run(self, data: dict) -> dict:
        serializer = SimulationParamsSerializer(data=data)
        serializer.is_valid(raise_exception=True)

        params = serializer.validated_data

        n = params['n_corridas']
        desde = params['desde']
        page = params['page']
        seed = params['seed']

        random.seed(seed)

        p1  = params['prob_etapa_1']
        p12 = p1 + params['prob_etapa_2']

        prob_control = params['prob_control']
        prob_demora = params['prob_demora']
        prob_intervencion = params['prob_intervencion']
        factor_demora = params['factor_demora']
        media_control = params['media_tiempo_control']
        media_intervencion = params['media_intervencion']

        lambda_control = 1/media_control
        lambda_intervencion = 1/media_intervencion

        media_tiempo_etapa = params['media_tiempo_etapa']
        desvio_tiempo_etapa = params['desvio_tiempo_etapa']

        total_pages = math.ceil((n - desde + 1) / WINDOW_SIZE)
        primera_fila_ventana = desde + (page - 1) * WINDOW_SIZE
        ultima_fila_ventana = min(primera_fila_ventana + WINDOW_SIZE - 1, n)

        # acumuladores escalares (no guardamos N filas en memoria)
        tiempo_total_acumulado = 0.0
        cantidad_paso_control_intervencion = 0
        cantidad_sin_demoras = 0
        tiempo_total_minimo = float('inf')
        tiempo_total_maximo = float('-inf')
        cantidad_jornadas_con_al_menos_una_calibracion = 0
        demoras_calibracion_acumuladas = 0.0
        cantidad_demoras_calibracion = 0
        demoras_extras_acumuladas = 0.0
        cantidad_demoras_extras = 0

        rows     = []   # solo va a contener las filas de la página solicitada
        last_row = None

        prev_rnd_e1 = None
        prev_rnd_e2 = None
        prev_rnd_e3 = None

        for i in range(1, n + 1):
            row = self._simular_corrida(
                i,
                p1,
                p12,
                prev_rnd_e1,
                prev_rnd_e2,
                prev_rnd_e3,
                media_tiempo_etapa,
                desvio_tiempo_etapa,
                prob_demora,
                factor_demora,
                prob_control,
                lambda_control,
                prob_intervencion,
                lambda_intervencion
            )

            prev_rnd_e1 = row.get('rnd_tiempo_etapa_1')
            prev_rnd_e2 = row.get('rnd_tiempo_etapa_2')
            prev_rnd_e3 = row.get('rnd_tiempo_etapa_3')

            # acumular tiempo total para promedio
            tiempo_total_acumulado += row['tiempo_total']

            # contar cantidad de veces que se paso por contro e intervencion
            if row["pasa_control"] and row["requiere_intervencion"]:
                cantidad_paso_control_intervencion += 1

            # cantidad de veces que no tuvieron demoras ni intervenciones extra
            if (not row["pasa_control"]
                and not row["requiere_intervencion"]
                and not row["tiene_demora_etapa_1"]
                and not row.get("tiene_demora_etapa_3", False)
            ):
                cantidad_sin_demoras +=1

            # actualizamos min y max sin necesidad de guardar todos los tiempos
            if row['tiempo_total'] < tiempo_total_minimo:
                tiempo_total_minimo = row['tiempo_total']
            if row['tiempo_total'] > tiempo_total_maximo:
                tiempo_total_maximo = row['tiempo_total']

            # cantidad de veces que hubo demoras de calibracion
            if row.get("tiene_demora_etapa_3", False) or row["tiene_demora_etapa_1"]:
                cantidad_jornadas_con_al_menos_una_calibracion += 1

            if row["tiene_demora_etapa_1"]:
                demoras_calibracion_acumuladas += row["tiempo_total_etapa_1"] - row["tiempo_etapa_1"]
                cantidad_demoras_calibracion += 1
            if row.get("tiene_demora_etapa_3", False):
                demoras_calibracion_acumuladas += row["tiempo_total_etapa_3"] - row["tiempo_etapa_3"]
                cantidad_demoras_calibracion += 1


            if row["pasa_control"] or row["requiere_intervencion"]:
                demora_control = row["tiempo_control"] if row["pasa_control"] else 0.0
                demora_intervencion = row["tiempo_intervencion"] if row["requiere_intervencion"] else 0.0
                demoras_extras_acumuladas += demora_control + demora_intervencion
                cantidad_demoras_extras += 1

            # volcamos al row el valor de los acumuladores hasta esta corrida
            row["acc_tiempo_total"] = tiempo_total_acumulado
            row["acc_demoras_calibracion"] = demoras_calibracion_acumuladas
            row["acc_demoras_extras"] = demoras_extras_acumuladas
            row["acc_count_ctrl_interv"] = cantidad_paso_control_intervencion
            row["acc_count_sin_demoras"] = cantidad_sin_demoras
            row["acc_count_jornadas_calibracion"] = cantidad_jornadas_con_al_menos_una_calibracion
            row["acc_count_demoras_calibracion"] = cantidad_demoras_calibracion
            row["acc_count_demoras_extras"] = cantidad_demoras_extras

            # guardamos solo si la corrida cae dentro de la ventana solicitada
            if primera_fila_ventana <= i <= ultima_fila_ventana:
                rows.append(row)

            # la última corrida siempre se guarda aparte
            if i == n:
                last_row = row

        # calcular variables adicionales
        tiempo_promedio = tiempo_total_acumulado/n
        porcentaje_pasa_control_intervencion = (cantidad_paso_control_intervencion*100)/n
        porcentaje_jornadas_con_al_menos_una_calibracion = (cantidad_jornadas_con_al_menos_una_calibracion*100)/n
        tiempo_promedio_demora_adicional = demoras_extras_acumuladas/cantidad_demoras_extras if cantidad_demoras_extras else 0.0
        tiempo_promedio_demora_calibracion = demoras_calibracion_acumuladas/cantidad_demoras_calibracion if cantidad_demoras_calibracion else 0.0

        response = {
            "total_corridas": n,
            "desde": desde,
            "page": page,
            "total_pages": total_pages,
            "rows" : rows,
            "last_row" : last_row,
            "tiempo_promedio": tiempo_promedio,
            "porcentaje_pasa_control_intervencion": porcentaje_pasa_control_intervencion,
            "cantidad_sin_demoras": cantidad_sin_demoras,
            "tiempo_total_minimo": tiempo_total_minimo,
            "tiempo_total_maximo": tiempo_total_maximo,
            "porcentaje_jornadas_con_al_menos_una_calibracion": porcentaje_jornadas_con_al_menos_una_calibracion,
            "tiempo_promedio_demora_adicional" : tiempo_promedio_demora_adicional,
            "tiempo_promedio_demora_calibracion": tiempo_promedio_demora_calibracion,
        }
        return response






    def _simular_corrida(self, i,
                                p1,
                                p12,
                                prev_rnd_e1,
                                prev_rnd_e2,
                                prev_rnd_e3,
                                media_tiempo_etapa,
                                desvio_tiempo_etapa,
                                prob_demora,
                                factor_demora,
                                prob_control,
                                lambda_control,
                                prob_intervencion,
                                lambda_intervencion) -> dict:

        row = {
            'reloj': i,
        }

        # ── Selección de línea ─────────────────────────────────────────────────
        rnd_etapas = random.random()
        row['rnd_cantidad_etapas'] = rnd_etapas
        if rnd_etapas < p1:
            n_etapas = 1
        elif rnd_etapas < p12:
            n_etapas = 2
        else:
            n_etapas = 3
        row['cantidad_etapas'] = n_etapas

        # Etapa 1 (todas las líneas)
        rnd1_e1 = random.random()
        rnd2_e1 = prev_rnd_e1 if prev_rnd_e1 is not None else 0
        t1 = max(0.0, self._normal(media_tiempo_etapa, desvio_tiempo_etapa, rnd1_e1, rnd2_e1))
        row['rnd_tiempo_etapa_1'] = rnd1_e1
        row['tiempo_etapa_1'] = t1

        # Demora solo en líneas 1 y 3
        rnd_tiene_demora_e1 = random.random()
        tiene_demora_e1 = rnd_tiene_demora_e1 < prob_demora
        t1_total = t1*factor_demora if tiene_demora_e1 else t1
        row['rnd_demora_etapa_1'] = rnd_tiene_demora_e1
        row['tiene_demora_etapa_1'] = tiene_demora_e1
        row['tiempo_total_etapa_1'] = t1_total

        tiempo_etapas = t1_total

        # Etapa 2 (líneas 2 y 3)
        if n_etapas >= 2:
            rnd1_e2 = random.random()
            rnd2_e2 = prev_rnd_e2 if prev_rnd_e2 is not None else 0
            t2 = max(0.0, self._normal(media_tiempo_etapa, desvio_tiempo_etapa, rnd1_e2, rnd2_e2))
            row['rnd_tiempo_etapa_2'] = rnd1_e2
            row['tiempo_etapa_2'] = t2
            tiempo_etapas += t2

        # Etapa 3 (línea 3)
        if n_etapas == 3:
            rnd1_e3 = random.random()
            rnd2_e3 = prev_rnd_e3 if prev_rnd_e3 is not None else 0
            t3 = max(0.0, self._normal(media_tiempo_etapa, desvio_tiempo_etapa, rnd1_e3, rnd2_e3))
            row['rnd_tiempo_etapa_3'] = rnd1_e3
            row['tiempo_etapa_3'] = t3

            rnd_tiene_demora_e3  = random.random()
            tiene_demora_e3 = rnd_tiene_demora_e3 < prob_demora
            t3_total = t3*factor_demora if tiene_demora_e3 else t3
            row['rnd_demora_etapa_3']  = rnd_tiene_demora_e3
            row['tiene_demora_etapa_3'] = tiene_demora_e3
            row['tiempo_total_etapa_3'] = t3_total
            tiempo_etapas += t3_total

        # Control
        rnd_control  = random.random()
        pasa_control = rnd_control < prob_control
        row['rnd_pasa_control'] = rnd_control
        row['pasa_control'] = pasa_control
        tiempo_control = None
        if pasa_control:
            rnd_tiempo_control = random.random()
            tiempo_control = self._exponential(lambda_control, rnd_tiempo_control)
            row['rnd_tiempo_control'] = rnd_tiempo_control
            row['tiempo_control'] = tiempo_control

        # Intervención extra
        rnd_requiere_intervencion  = random.random()
        requiere_intervencion  = rnd_requiere_intervencion < prob_intervencion
        row['rnd_requiere_intervencion'] = rnd_requiere_intervencion
        row['requiere_intervencion'] = requiere_intervencion
        tiempo_intervencion = None
        if requiere_intervencion:
            rnd_tiempo_intervencion  = random.random()
            tiempo_intervencion = self._exponential(lambda_intervencion, rnd_tiempo_intervencion)
            row['rnd_tiempo_intervencion'] = rnd_tiempo_intervencion
            row['tiempo_intervencion'] = tiempo_intervencion

        row['tiempo_total'] = tiempo_etapas + (tiempo_control or 0.0) + (tiempo_intervencion or 0.0)
        return row

    def _normal(self, mean: float, std: float, rnd1: float, rnd2: float) -> float:
        return (math.sqrt(-2 * math.log(rnd1)) * math.cos(2 * math.pi * rnd2)) * std + mean


    def _exponential(self, _lambda: float, rnd: float) -> float:
        return -1/_lambda*math.log(1 - rnd)

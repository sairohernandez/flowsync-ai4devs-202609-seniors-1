# Matriz
**Scenarios del requisito: 3 · Cubiertos: 0**

| Scenario | Test que lo cubre | Estado | Qué faltó para decidir |
|---|---|---|---|
| Responsable "Ada Lovelace": su `assignee` trae el nombre y las iniciales | — | No lo sé | Existe un test parecido, pero comprueba `data.user.initials` en `/auth/login`, no el `assignee` de una tarea. |
| Cualquier tarea (suelta o en lista): su `assignee` no incluye email ni otros datos de acceso | — | No cubierto | No hay ningún test que mire el `assignee` de una tarea. |
| Responsable sin nombre: nombre nulo e iniciales presentes, sin recurrir al email | — | No lo sé | Se parece al caso "sin nombre" de `initials.spec.ts`, pero ese es el login y no comprueba que el nombre llegue nulo. |


# Tres lineas
1. Cuántos scenarios creías cubiertos antes de mirar, y cuántos lo estaban


R/ 3 Escenarios 0 cubiertos me di cuenta porque no habia ningun test relacinado a tareas

2. El scenario en el que no supiste si faltaba un test o faltaba la regla en la spec

R/ Ninguno al no cubrir los test ningun escenario

3. Algo que el scenario no determinaba y tuviste que decidir al escribir el test.

Validar que las iniciales superaran los dos caracteres cuando el responsable es nulo
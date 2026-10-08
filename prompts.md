# Prompts
## Prompts 1 

Lee los scenarios de la spec viva de esta feature y los tests existentes.
Genera una tabla de trazabilidad: 

Trabaja sobre el requisito "Lo que cada tarea muestra de su responsable",  no la capability entera



Una fila por scenario y cuatro columnas. 

    1. El scenario, en una línea. Qué se espera y en qué situación. Si no cabe en una línea, es que estás juntando dos.

	2. Qué test lo cubre, con el nombre exacto que aparece en la suite. Sin el nombre concreto, la columna va vacía: "seguro que algo lo cubre" no es una fila.

    3. Cubierto / No cubierto · No lo sé. Los tres estados son válidos, y el tercero no es un fallo: es el resultado más informativo de los tres.

Si pusiste "no lo sé", qué te faltó para decidirlo. Media línea. Suele ser una de dos: no encontraste dónde se comprueba, o encontraste algo que se le parece y no dice exactamente lo mismo.

Encima, dos números: cuántos scenarios tiene el requisito y cuántos resultaron cubiertos
No cambies nada.


## Prompts 2

Escribe un test para cada caso y en el  requesito tres agrega
Validar que las iniciales superaran los dos caracteres cuando el responsable es nulo

Los tests que escribas van en backend/tests/functional/tasks/, siguiendo el estilo de los que ya hay en backend/tests/functional/auth/. No toques nada fuera de backend/tests/

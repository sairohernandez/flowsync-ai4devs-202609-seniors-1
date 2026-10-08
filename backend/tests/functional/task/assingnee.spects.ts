import Task from '#models/task'
import User from '#models/user'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * Lo que cada tarea muestra de su responsable. Cubre los tres scenarios del
 * requisito «Lo que cada tarea muestra de su responsable» de
 * `openspec/specs/tasks/spec.md`: responsable identificable, la tarea no
 * filtra datos de cuenta, y responsable sin nombre. Cada uno se comprueba en
 * las dos lecturas que traen el `assignee`: la tarea suelta y la lista.
 */
test.group('Tasks | responsable', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  const HOY = '2026-10-07'

  async function sesion(client: any) {
    await User.create({
      fullName: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'secreto123',
    })

    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: 'grace@example.com', password: 'secreto123' })

    return response.body().data.token as string
  }

  async function tareaDe(fullName: string | null, email = 'ada@example.com') {
    const responsable = await User.create({ fullName, email, password: 'secreto123' })
    return Task.create({
      title: 'Revisar inventario',
      status: 'pending',
      assigneeId: responsable.id,
    })
  }

  async function leerSuelta(client: any, token: string, id: number) {
    const response = await client
      .get(`/api/v1/tasks/${id}`)
      .qs({ today: HOY })
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)
    return response.body().data.assignee
  }

  async function leerEnLista(client: any, token: string, id: number) {
    const response = await client.get('/api/v1/tasks').header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)
    return response.body().data.find((t: any) => t.id === id).assignee
  }

  // Scenario 1: responsable identificable

  test('la tarea suelta trae el nombre y las iniciales del responsable', async ({
    client,
    assert,
  }) => {
    const token = await sesion(client)
    const tarea = await tareaDe('Ada Lovelace')

    const assignee = await leerSuelta(client, token, tarea.id)

    assert.equal(assignee.fullName, 'Ada Lovelace')
    assert.equal(assignee.initials, 'AL')
  })

  test('la lista trae el nombre y las iniciales del responsable de cada tarea', async ({
    client,
    assert,
  }) => {
    const token = await sesion(client)
    const tarea = await tareaDe('Ada Lovelace')

    const assignee = await leerEnLista(client, token, tarea.id)

    assert.equal(assignee.fullName, 'Ada Lovelace')
    assert.equal(assignee.initials, 'AL')
  })

  // Scenario 2: la tarea no filtra datos de cuenta

  test('la tarea suelta no incluye el email ni otros datos de la cuenta del responsable', async ({
    client,
    assert,
  }) => {
    const token = await sesion(client)
    const tarea = await tareaDe('Ada Lovelace')

    const assignee = await leerSuelta(client, token, tarea.id)

    assert.notProperty(assignee, 'email')
    assert.deepEqual(Object.keys(assignee).sort(), ['fullName', 'id', 'initials'])
  })

  test('la lista no incluye el email ni otros datos de la cuenta del responsable', async ({
    client,
    assert,
  }) => {
    const token = await sesion(client)
    const tarea = await tareaDe('Ada Lovelace')

    const assignee = await leerEnLista(client, token, tarea.id)

    assert.notProperty(assignee, 'email')
    assert.deepEqual(Object.keys(assignee).sort(), ['fullName', 'id', 'initials'])
  })

  // Scenario 3: responsable sin nombre

  test('la tarea suelta de un responsable sin nombre trae el nombre nulo y las iniciales', async ({
    client,
    assert,
  }) => {
    const token = await sesion(client)
    const tarea = await tareaDe(null)

    const assignee = await leerSuelta(client, token, tarea.id)

    assert.isNull(assignee.fullName)
    assert.isString(assignee.initials)
    assert.isAbove(assignee.initials.length, 0)
  })

  test('la lista de un responsable sin nombre trae el nombre nulo y las iniciales', async ({
    client,
    assert,
  }) => {
    const token = await sesion(client)
    const tarea = await tareaDe(null)

    const assignee = await leerEnLista(client, token, tarea.id)

    assert.isNull(assignee.fullName)
    assert.isString(assignee.initials)
    assert.isAbove(assignee.initials.length, 0)
  })

  test('las iniciales de un responsable sin nombre no pasan de dos caracteres', async ({
    client,
    assert,
  }) => {
    const token = await sesion(client)
    // Parte local larga y con punto: las iniciales no pueden crecer con el email.
    const tarea = await tareaDe(null, 'ada.lovelace.augusta@example.com')

    const suelta = await leerSuelta(client, token, tarea.id)
    const enLista = await leerEnLista(client, token, tarea.id)

    assert.isAtMost(suelta.initials.length, 2)
    assert.isAtMost(enLista.initials.length, 2)
  })
})

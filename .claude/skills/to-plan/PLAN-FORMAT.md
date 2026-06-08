# Plan Format

Plans live in `docs/plans/` and follow the lifecycle and naming convention described in `docs/plans/README.md`.

## Template

```md
# Plano de Execução - {Nome}

Este plano segue as convenções descritas em [docs/plans/README.md](../plans/README.md).

## Referências

- [docs/plans/README.md](../plans/README.md)
- [CONTEXT.md](../../CONTEXT.md)
- [ADR NNNN - Título](../adr/NNNN-slug.md)

## Decisões de design já tomadas

Ponteiros para ADRs. Sem repetição de rationale.

- **{Decisão}**: ver [ADR NNNN](../adr/NNNN-slug.md)

---

## Fase 1 - {Nome}

**Objetivo:** {Uma frase. O que estará verdadeiro ao final desta fase que não está agora.}

**Status:** `não iniciado`

### Entregas

- {Artefato concreto: arquivo criado, função implementada, tipo definido}
- {Outro artefato}

### Testes

- {Arquivo de teste e o que ele cobre. Omitir seção apenas se a fase não produz lógica testável.}

### Validação

- {Critério verificável: teste passa, pnpm typecheck sem erros, comportamento observável}
```

## Rules

- **Referências** listam CONTEXT.md e cada ADR que influencia o escopo do plano. Não listar ADRs irrelevantes.
- **Decisões de design** é a única seção que pode referenciar decisões - nunca as fases. Se uma fase depende de uma decisão não registrada em ADR, a decisão deve ser registrada antes de o plano ser escrito.
- **Objetivo** de fase é um estado do mundo, não uma tarefa. "Scheduler aceita eventos e os despacha em ordem de prioridade" é um objetivo. "Implementar o scheduler" não é.
- **Entregas** nomeiam artefatos específicos. Nunca use "implementar X" sem nomear onde X vive e o que X é.
- **Testes** lista os arquivos de teste e o que cada um cobre. A seção pode ser omitida apenas quando a fase não produz lógica testável (ex: fases puramente de scaffolding ou configuração).
- **Validação** deve ser checável por alguém que não escreveu o código. Prefira `pnpm test:run`, `pnpm typecheck`, ou comportamento observável via REPL/log.
- **Status** inicial é sempre `não iniciado`. Só o executor atualiza o status.

---

## Exemplo canônico

```md
# Plano de Execução - Scheduler Core

Este plano segue as convenções descritas em [docs/plans/README.md](../plans/README.md).

## Referências

- [docs/plans/README.md](../plans/README.md)
- [CONTEXT.md](../../CONTEXT.md)
- [ADR 0003 - Ordenação de Prioridade de Eventos do Scheduler](../adr/0003-scheduler-event-priority-ordering.md)

## Decisões de design já tomadas

- **Ordering**: tuple `(executeAt, priority, sequence)`; ver [ADR 0003](../adr/0003-scheduler-event-priority-ordering.md)
- **Death não é scheduler event**: resolução síncrona inline; ver [ADR 0003](../adr/0003-scheduler-event-priority-ordering.md)
- **Same-timestamp enqueue durante dispatch throws**: programmer error, fail fast; ver [ADR 0003](../adr/0003-scheduler-event-priority-ordering.md)
- **AOI flush é pós-drain no network layer**: não é scheduler event; ver [ADR 0003](../adr/0003-scheduler-event-priority-ordering.md)

---

## Fase 1 - Min-heap e enqueue

**Objetivo:** O scheduler aceita eventos com `(executeAt, priority, sequence)` e os mantém ordenados corretamente na fila.

**Status:** `não iniciado`

### Entregas

- `engine/src/scheduler/scheduler.ts` com `Scheduler` class: `enqueue(event)`, `peek()`, `isEmpty()`
- Min-heap interno ordenado por `(executeAt, priority, sequence)`
- `sequence` como contador monotônico atribuído no enqueue
- Tipos em `engine/src/scheduler/types.ts`: `SchedulerEvent<T>`, `EventHandler<T>`

### Testes

- `engine/src/scheduler/scheduler.test.ts`: ordering por `executeAt`, ordering por `priority` dentro do mesmo timestamp, ordering por `sequence` dentro do mesmo `(time, priority)`

### Validação

- `pnpm --filter @paradox/engine test:run` passa para `scheduler/scheduler.test.ts`
- Dois eventos com mesmo `executeAt` e mesmo `priority` saem em ordem de inserção (sequence)
- Dois eventos com mesmo `executeAt` e priorities diferentes saem na ordem correta de priority

---

## Fase 2 - Dispatch e non-reentrance

**Objetivo:** O scheduler drena e despacha eventos em ordem, rejeitando enqueues com `executeAt == simulationNow` durante dispatch.

**Status:** `não iniciado`

### Entregas

- `drain(simulationNow: number, ctx: SimulationContext): void` em `Scheduler`
- `SimulationContext` em `engine/src/scheduler/types.ts`: `{ rng: PRNG, now: number, enqueue: SafeEnqueue }`
- `SafeEnqueue` lança `SchedulerReentranceError` se `executeAt <= simulationNow` durante dispatch
- `SchedulerReentranceError` em `engine/src/scheduler/errors.ts`

### Testes

- `engine/src/scheduler/scheduler.test.ts`: drain despacha em ordem; handler enfileirando com `executeAt == simulationNow` lança `SchedulerReentranceError`; handler enfileirando com `executeAt > simulationNow` é processado no drain seguinte

### Validação

- Enqueue com `executeAt == simulationNow` durante dispatch lança `SchedulerReentranceError`
- Enqueue com `executeAt > simulationNow` durante dispatch é aceito e processado no próximo drain
- `pnpm --filter @paradox/engine test:run` passa para `scheduler/scheduler.test.ts`

---

## Fase 3 - Version Tag e descarte de eventos stale

**Objetivo:** Eventos para entidades mortas ou inválidas são descartados silenciosamente no dispatch.

**Status:** `não iniciado`

### Entregas

- Campo `generation: number` em `SchedulerEvent<T>`
- `VersionTagRegistry` em `engine/src/scheduler/version-tag.ts`: `register(id)`, `increment(id)`, `current(id)`
- Lógica de descarte em `drain`: evento é dropado se `event.generation !== registry.current(event.entityId)`

### Testes

- `engine/src/scheduler/version-tag.test.ts`: evento com geração stale é descartado; evento com geração atual é despachado; múltiplos increments acumulam corretamente
- `engine/src/scheduler/scheduler.test.ts`: drain com entidade morta (generation incrementada) descarta eventos pendentes sem lançar

### Validação

- Evento enfileirado antes de `increment(id)` é descartado no drain seguinte
- Evento enfileirado após `increment(id)` é despachado normalmente
- `pnpm --filter @paradox/engine test:run` passa para `scheduler/version-tag.test.ts`
```

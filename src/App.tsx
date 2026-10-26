import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, PRIORITIES, type ActionItem, type Priority, type Retrospective, type Team } from './api'
import './App.css'

type Run = (action: () => Promise<unknown>) => Promise<void>

const today = () => new Date().toISOString().slice(0, 10)

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

function Avatar({ name }: { name: string }) {
  const hue = [...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360
  return (
    <span className="avatar" style={{ background: `hsl(${hue} 65% 55%)` }} title={name} aria-hidden>
      {name.slice(0, 2).toUpperCase()}
    </span>
  )
}

export default function App() {
  const [error, setError] = useState<string | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [actingAs, setActingAs] = useState('')
  const [retros, setRetros] = useState<Retrospective[]>([])
  const [selectedRetroId, setSelectedRetroId] = useState<number | null>(null)

  const run: Run = useCallback(async (action) => {
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const refreshRetros = useCallback(
    (teamId: number) => run(async () => setRetros(await api.listRetrospectives(teamId))),
    [run],
  )

  const openTeam = (loaded: Team) => {
    setTeam(loaded)
    setActingAs(loaded.members[0] ?? '')
    setSelectedRetroId(null)
    refreshRetros(loaded.id)
  }

  const selectedRetro = retros.find((r) => r.id === selectedRetroId) ?? null

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            R
          </span>
          <div>
            <h1>RetroFlow</h1>
            <p>Retrospectives your team actually follows up on</p>
          </div>
        </div>
        {team && (
          <label className="acting-as">
            <Avatar name={actingAs} />
            <span className="acting-as-label">
              <small>Acting as</small>
              <select value={actingAs} onChange={(e) => setActingAs(e.target.value)}>
                {team.members.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </span>
          </label>
        )}
      </header>

      <main>
        {error && (
          <div className="toast" role="alert">
            <strong>Request failed</strong>
            <span>{error}</span>
            <button className="icon" aria-label="Dismiss" onClick={() => setError(null)}>
              ×
            </button>
          </div>
        )}

        <TeamPanel team={team} run={run} onTeam={openTeam} />

        {team && (
          <div className="columns">
            <RetroList
              team={team}
              retros={retros}
              actingAs={actingAs}
              selectedId={selectedRetroId}
              run={run}
              onSelect={setSelectedRetroId}
              onChanged={() => refreshRetros(team.id)}
            />
            {selectedRetro ? (
              <RetroDetail
                key={selectedRetro.id}
                retro={selectedRetro}
                actingAs={actingAs}
                run={run}
                onChanged={() => refreshRetros(team.id)}
              />
            ) : (
              <section className="card empty-state">
                <h2>Pick a retrospective</h2>
                <p>Select one on the left, or open a new one, to see and manage its action items.</p>
              </section>
            )}
          </div>
        )}
      </main>
    </>
  )
}

function TeamPanel({ team, run, onTeam }: { team: Team | null; run: Run; onTeam: (t: Team) => void }) {
  const [name, setName] = useState('')
  const [members, setMembers] = useState('')
  const [teamId, setTeamId] = useState('')

  const create = (e: FormEvent) => {
    e.preventDefault()
    const memberList = members.split(',').map((m) => m.trim()).filter(Boolean)
    run(async () => {
      onTeam(await api.createTeam(name.trim(), memberList))
      setName('')
      setMembers('')
    })
  }

  const load = (e: FormEvent) => {
    e.preventDefault()
    run(async () => onTeam(await api.getTeam(Number(teamId))))
  }

  const forms = (
    <div className="team-forms">
      <form onSubmit={create} className="stack">
        <h3>Create a team</h3>
        <input aria-label="Team name" placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          aria-label="Members"
          placeholder="Members, comma separated"
          value={members}
          onChange={(e) => setMembers(e.target.value)}
          required
        />
        <button className="primary">Create team</button>
      </form>
      <div className="divider">or</div>
      <form onSubmit={load} className="stack">
        <h3>Open an existing team</h3>
        <input
          aria-label="Team id"
          type="number"
          min={1}
          placeholder="Team id"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          required
        />
        <button>Open team</button>
      </form>
    </div>
  )

  if (!team) {
    return (
      <section className="card hero">
        <h2>Welcome to RetroFlow</h2>
        <p className="muted">Create a team or open one by its id to get started.</p>
        {forms}
      </section>
    )
  }

  return (
    <section className="card team-bar">
      <div className="team-summary">
        <div>
          <small className="eyebrow">Team #{team.id}</small>
          <h2>{team.name}</h2>
        </div>
        <ul className="members">
          {team.members.map((m) => (
            <li key={m}>
              <Avatar name={m} />
              {m}
            </li>
          ))}
        </ul>
      </div>
      <details>
        <summary>Switch or create team</summary>
        {forms}
      </details>
    </section>
  )
}

function RetroList(props: {
  team: Team
  retros: Retrospective[]
  actingAs: string
  selectedId: number | null
  run: Run
  onSelect: (id: number) => void
  onChanged: () => void
}) {
  const { team, retros, actingAs, selectedId, run, onSelect, onChanged } = props
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)

  const create = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      const retro = await api.createRetrospective(team.id, title.trim(), date, actingAs)
      setTitle('')
      onChanged()
      onSelect(retro.id)
    })
  }

  return (
    <section className="card">
      <h2>Retrospectives</h2>
      <form onSubmit={create} className="stack">
        <input aria-label="Title" placeholder="e.g. Sprint 8 Retro" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="row">
          <input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <button className="primary">Open retro</button>
        </div>
      </form>
      <ul className="retros">
        {retros.map((r) => (
          <li key={r.id}>
            <button className={r.id === selectedId ? 'selected' : ''} onClick={() => onSelect(r.id)}>
              <span className="retro-title">{r.title}</span>
              <span className="retro-meta">
                {formatDate(r.date)}
                <span className={`pill ${r.status}`}>{r.status === 'OPEN' ? 'Open' : 'Closed'}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {retros.length === 0 && <p className="empty">No retrospectives yet. Open the first one above.</p>}
    </section>
  )
}

function RetroDetail({ retro, actingAs, run, onChanged }: { retro: Retrospective; actingAs: string; run: Run; onChanged: () => void }) {
  const [title, setTitle] = useState(retro.title)
  const [date, setDate] = useState(retro.date)
  const isOpen = retro.status === 'OPEN'

  const save = (e: FormEvent) => {
    e.preventDefault()
    const changes = { title: title !== retro.title ? title.trim() : undefined, date: date !== retro.date ? date : undefined }
    run(async () => {
      await api.updateRetrospective(retro.id, changes, actingAs)
      onChanged()
    })
  }

  const close = () =>
    run(async () => {
      await api.closeRetrospective(retro.id, actingAs)
      onChanged()
    })

  return (
    <section className="card detail">
      <div className="detail-header">
        <div>
          <small className="eyebrow">{formatDate(retro.date)}</small>
          <h2>{retro.title}</h2>
        </div>
        <span className={`pill large ${retro.status}`}>{isOpen ? 'Open' : 'Closed'}</span>
      </div>
      {isOpen ? (
        <form onSubmit={save} className="row edit-row">
          <input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <button disabled={title === retro.title && date === retro.date}>Save</button>
          <button type="button" className="danger" onClick={close}>
            Close retro
          </button>
        </form>
      ) : (
        <p className="notice">This retrospective is closed. Action items can still be completed, nothing else changes.</p>
      )}
      <ActionItems retro={retro} actingAs={actingAs} run={run} />
    </section>
  )
}

function ActionItems({ retro, actingAs, run }: { retro: Retrospective; actingAs: string; run: Run }) {
  const [items, setItems] = useState<ActionItem[]>([])
  const [content, setContent] = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('MEDIUM')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [completed, setCompleted] = useState<'' | 'true' | 'false'>('')

  const refresh = useCallback(
    () =>
      run(async () =>
        setItems(await api.listActionItems(retro.id, priority || undefined, completed ? completed === 'true' : undefined)),
      ),
    [run, retro.id, priority, completed],
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  const update = (id: number, changes: { priority?: Priority; completed?: boolean }) =>
    run(async () => {
      await api.updateActionItem(id, changes)
      await refresh()
    })

  const add = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      await api.addActionItem(retro.id, content.trim(), actingAs, newPriority)
      setContent('')
      await refresh()
    })
  }

  const doneCount = items.filter((i) => i.completed).length

  return (
    <div className="action-items">
      <div className="section-header">
        <h3>Action items</h3>
        {items.length > 0 && (
          <div className="progress" title={`${doneCount} of ${items.length} completed`}>
            <div className="progress-bar">
              <span style={{ width: `${(doneCount / items.length) * 100}%` }} />
            </div>
            <small>
              {doneCount}/{items.length} done
            </small>
          </div>
        )}
      </div>

      {retro.status === 'OPEN' && (
        <form onSubmit={add} className="row add-row">
          <input
            aria-label="New action item"
            placeholder="What will the team do differently?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
          <select aria-label="New action item priority" value={newPriority} onChange={(e) => setNewPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <button className="primary">Add</button>
        </form>
      )}

      <div className="row filters">
        <select aria-label="Priority filter" value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select aria-label="Completed filter" value={completed} onChange={(e) => setCompleted(e.target.value as '' | 'true' | 'false')}>
          <option value="">All states</option>
          <option value="false">Open</option>
          <option value="true">Completed</option>
        </select>
      </div>

      <ul className="items">
        {items.map((item) => (
          <li key={item.id} className={`priority-${item.priority}${item.completed ? ' done' : ''}`}>
            <button
              className="check"
              aria-label={item.completed ? 'Completed' : `Complete "${item.content}"`}
              disabled={item.completed}
              onClick={() => update(item.id, { completed: true })}
            >
              ✓
            </button>
            <div className="item-body">
              <span className="item-content">{item.content}</span>
              <span className="item-author">
                <Avatar name={item.author} />
                {item.author}
              </span>
            </div>
            <select
              aria-label="Priority"
              className={`priority-select priority-${item.priority}`}
              value={item.priority}
              disabled={retro.status === 'CLOSED'}
              onChange={(e) => update(item.id, { priority: e.target.value as Priority })}
            >
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="empty">{priority || completed ? 'No action items match these filters.' : 'No action items yet.'}</p>
      )}
    </div>
  )
}

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH'
export type RetrospectiveStatus = 'OPEN' | 'CLOSED'

export interface Team {
  id: number
  name: string
  members: string[]
}

export interface Retrospective {
  id: number
  teamId: number
  title: string
  date: string
  status: RetrospectiveStatus
}

export interface ActionItem {
  id: number
  retrospectiveId: number
  content: string
  author: string
  priority: Priority
  completed: boolean
}

export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH']

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error ?? `${response.status} ${response.statusText}`)
  }
  return data as T
}

export const api = {
  createTeam: (name: string, members: string[]) => request<Team>('POST', '/teams', { name, members }),
  getTeam: (id: number) => request<Team>('GET', `/teams/${id}`),
  listRetrospectives: (teamId: number) => request<Retrospective[]>('GET', `/teams/${teamId}/retrospectives`),
  createRetrospective: (teamId: number, title: string, date: string, createdBy: string) =>
    request<Retrospective>('POST', `/teams/${teamId}/retrospectives`, { title, date, createdBy }),
  updateRetrospective: (id: number, changes: { title?: string; date?: string }, updatedBy: string) =>
    request<Retrospective>('PATCH', `/retrospectives/${id}`, { ...changes, updatedBy }),
  closeRetrospective: (id: number, closedBy: string) =>
    request<Retrospective>('PUT', `/retrospectives/${id}/close`, { closedBy }),
  listActionItems: (retrospectiveId: number, priority?: Priority, completed?: boolean) => {
    const params = new URLSearchParams()
    if (priority) params.set('priority', priority)
    if (completed !== undefined) params.set('completed', String(completed))
    const query = params.size ? `?${params}` : ''
    return request<ActionItem[]>('GET', `/retrospectives/${retrospectiveId}/action-items${query}`)
  },
  addActionItem: (retrospectiveId: number, content: string, author: string, priority: Priority) =>
    request<ActionItem>('POST', `/retrospectives/${retrospectiveId}/action-items`, { content, author, priority }),
  updateActionItem: (id: number, changes: { priority?: Priority; completed?: boolean }) =>
    request<ActionItem>('PATCH', `/action-items/${id}`, changes),
}

import { useState } from 'react'
import { Empty, PageHeader } from '../components/ui'
import { useData } from '../data/DataContext'
import type { Todo } from '../data/types'
import { useI18n } from '../i18n'

export function TodoScreen() {
  const { t } = useI18n()
  const { todos, save, remove } = useData()
  const [text, setText] = useState('')
  const [showDone, setShowDone] = useState(false)

  const open = todos.filter((td) => !td.done).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const done = todos.filter((td) => td.done).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))

  const toggle = (td: Todo) => save('todos', { ...td, done: !td.done, done_at: td.done ? null : new Date().toISOString() })

  return (
    <>
      <PageHeader title={t('todo.title')} subtitle={t('todo.subtitle')} />
      <form
        className="card todo-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!text.trim()) return
          await save('todos', { text: text.trim(), done: false, done_at: null, created_at: new Date().toISOString() })
          setText('')
        }}
      >
        <textarea rows={2} placeholder={t('todo.placeholder')} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn primary block">{t('todo.add')}</button>
      </form>

      {open.length === 0 ? (
        <Empty>{t('common.empty')}</Empty>
      ) : (
        <ul className="card todo-list">
          {open.map((td) => (
            <TodoRow key={td.id} todo={td} onToggle={() => toggle(td)} onDelete={() => remove('todos', td.id)} />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <section className="section">
          <button className="btn link" onClick={() => setShowDone(!showDone)}>
            {showDone ? '▾' : '▸'} {t('todo.completed', { n: done.length })}
          </button>
          {showDone && (
            <ul className="card todo-list done">
              {done.map((td) => (
                <TodoRow key={td.id} todo={td} onToggle={() => toggle(td)} onDelete={() => remove('todos', td.id)} />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function TodoRow({ todo, onToggle, onDelete }: { todo: Todo; onToggle: () => void; onDelete: () => void }) {
  const { t } = useI18n()
  return (
    <li>
      <label className="check">
        <input type="checkbox" checked={todo.done} onChange={onToggle} />
        <span className="todo-text">{todo.text}</span>
      </label>
      <button className="btn icon subtle" aria-label={t('common.delete')} onClick={onDelete}>
        ×
      </button>
    </li>
  )
}

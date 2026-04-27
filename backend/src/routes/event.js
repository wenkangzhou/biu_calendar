const Router = require('koa-router')
const { all, get, run } = require('../db')
const { authMiddleware } = require('../middleware/auth')
const { sendSubscribeMessage } = require('../utils/wx')
const { isReviewMode } = require('../config')

const router = new Router({ prefix: '/api/events' })
router.use(authMiddleware())

function validateEvent(data) {
  if (!data.title || data.title.trim() === '') return '标题不能为空'
  if (!data.startTime) return '开始时间不能为空'
  if (!data.endTime) return '结束时间不能为空'
  if (new Date(data.startTime) > new Date(data.endTime)) return '开始时间不能晚于结束时间'
  return null
}

async function getFamilyByMember(openid) {
  const rows = await all('SELECT * FROM families')
  for (const row of rows) {
    const members = JSON.parse(row.members || '[]')
    if (members.some(m => m.openid === openid)) {
      return { ...row, members }
    }
  }
  return null
}

function rowToEvent(row) {
  if (!row) return null
  return {
    ...row,
    _id: String(row.id),
    participants: JSON.parse(row.participants || '[]'),
    reminders: JSON.parse(row.reminders || '[]'),
    is_all_day: !!row.is_all_day,
    is_done: !!row.is_done
  }
}

// GET /api/events/search?q=xxx
router.get('/search', async (ctx) => {
  const { openid } = ctx.state.user
  const { q } = ctx.query
  if (!q || !q.trim()) {
    ctx.body = { code: 400, msg: '搜索词不能为空' }
    return
  }

  const family = await getFamilyByMember(openid)
  if (!family) {
    ctx.body = { code: 404, msg: '未加入任何家庭' }
    return
  }

  const keyword = q.trim()
  let rows = await all(
    `SELECT * FROM events WHERE family_id = ? AND (instr(title, ?) > 0 OR instr(location, ?) > 0 OR instr(remark, ?) > 0) ORDER BY start_time DESC`,
    [family.id, keyword, keyword, keyword]
  )

  // 审核模式：只搜索自己的日程
  if (isReviewMode()) {
    rows = rows.filter(r => r.creator_openid === openid)
  }

  // 按成员昵称搜索（审核模式跳过）
  let memberRows = []
  if (!isReviewMode()) {
    const members = family.members || []
    const matchedMembers = members.filter(m => m.nickName && m.nickName.includes(q.trim()))
    if (matchedMembers.length > 0) {
      const openids = matchedMembers.map(m => m.openid)
      const placeholders = openids.map(() => '?').join(',')
      memberRows = await all(
        `SELECT * FROM events WHERE family_id = ? AND creator_openid IN (${placeholders})`,
        [family.id, ...openids]
      )
    }
  }

  const seen = new Set()
  const results = []
  for (const row of [...rows, ...memberRows]) {
    if (!seen.has(row.id)) {
      seen.add(row.id)
      results.push(rowToEvent(row))
    }
  }

  ctx.body = { code: 200, data: results }
})

// GET /api/events?year=2026&month=4  或 ?date=2026-04-22  或 ?stats=1
router.get('/', async (ctx) => {
  const { openid } = ctx.state.user
  const { year, month, date, stats } = ctx.query

  const family = await getFamilyByMember(openid)
  if (!family) {
    ctx.body = { code: 404, msg: '未加入任何家庭' }
    return
  }

  // 统计模式
  if (stats !== undefined) {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

    const totalRow = await get('SELECT COUNT(*) as count FROM events WHERE family_id = ?', [family.id])
    const todayRow = await get(
      `SELECT COUNT(*) as count FROM events WHERE family_id = ? AND (
        (start_time >= ? AND start_time <= ?) OR
        (end_time >= ? AND end_time <= ?) OR
        (start_time < ? AND end_time > ?)
      )`,
      [family.id, todayStart, todayEnd, todayStart, todayEnd, todayStart, todayEnd]
    )
    const todoRow = await get(
      `SELECT COUNT(*) as count FROM events WHERE family_id = ? AND end_time >= ? AND is_done = 0`,
      [family.id, todayStart]
    )

    ctx.body = {
      code: 200,
      data: {
        total: totalRow ? totalRow.count : 0,
        today: todayRow ? todayRow.count : 0,
        todo: todoRow ? todoRow.count : 0
      }
    }
    return
  }

  let rows
  if (year && month) {
    const y = parseInt(year)
    const m = parseInt(month)
    const start = new Date(y, m - 1, 1, 0, 0, 0).toISOString()
    const end = new Date(y, m, 1, 0, 0, 0).toISOString()
    rows = await all(
      `SELECT * FROM events WHERE family_id = ? AND (
        (start_time >= ? AND start_time < ?) OR
        (end_time >= ? AND end_time < ?) OR
        (start_time < ? AND end_time >= ?)
      ) ORDER BY start_time ASC`,
      [family.id, start, end, start, end, start, end]
    )
  } else if (date) {
    const [y, m, d] = date.split('-').map(Number)
    const dayStart = new Date(y, m - 1, d, 0, 0, 0).toISOString()
    const dayEnd = new Date(y, m - 1, d, 23, 59, 59).toISOString()
    rows = await all(
      `SELECT * FROM events WHERE family_id = ? AND (
        (start_time >= ? AND start_time <= ?) OR
        (end_time >= ? AND end_time <= ?) OR
        (start_time < ? AND end_time > ?)
      ) ORDER BY start_time ASC`,
      [family.id, dayStart, dayEnd, dayStart, dayEnd, dayStart, dayEnd]
    )
  } else {
    ctx.body = { code: 400, msg: '缺少查询参数' }
    return
  }

  let events = rows.map(rowToEvent)
  // 过滤不可见的个人日程
  events = events.filter(evt => {
    if (evt.type === 'personal' && evt.visibility === 'private') {
      return evt.creator_openid === openid
    }
    return true
  })

  // 审核模式：只返回自己创建的日程
  if (isReviewMode()) {
    events = events.filter(evt => evt.creator_openid === openid)
  }

  ctx.body = { code: 200, data: events }
})

// GET /api/events/:id
router.get('/:id', async (ctx) => {
  const { openid } = ctx.state.user
  const id = parseInt(ctx.params.id)

  const row = await get('SELECT * FROM events WHERE id = ?', [id])
  if (!row) {
    ctx.body = { code: 404, msg: '日程不存在' }
    return
  }

  const family = await getFamilyByMember(openid)
  if (!family || family.id !== row.family_id) {
    ctx.body = { code: 403, msg: '无权访问' }
    return
  }

  const evt = rowToEvent(row)
  if (evt.type === 'personal' && evt.visibility === 'private' && evt.creator_openid !== openid) {
    ctx.body = { code: 403, msg: '无权查看' }
    return
  }

  ctx.body = { code: 200, data: evt }
})

// POST /api/events
router.post('/', async (ctx) => {
  const { openid } = ctx.state.user
  const data = ctx.request.body

  const err = validateEvent(data)
  if (err) {
    ctx.body = { code: 400, msg: err }
    return
  }

  const family = await getFamilyByMember(openid)
  if (!family) {
    ctx.body = { code: 404, msg: '未加入任何家庭' }
    return
  }

  const { title, type, participants, isAllDay, startTime, endTime, location, remark, reminderEnabled } = data

  const result = await run(
    `INSERT INTO events
    (family_id, creator_openid, title, type, participants, is_all_day, start_time, end_time, location, remark, visibility, reminders)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      family.id,
      openid,
      title.trim(),
      type || 'personal',
      JSON.stringify(participants || [openid]),
      isAllDay ? 1 : 0,
      new Date(startTime).toISOString(),
      new Date(endTime).toISOString(),
      location || '',
      remark || '',
      (type === 'family' ? 'family' : 'private'),
      JSON.stringify({ enabled: !!reminderEnabled })
    ]
  )

  const evt = rowToEvent(await get('SELECT * FROM events WHERE id = ?', [result.lastID]))

  // 发送订阅消息提醒
  if (reminderEnabled) {
    try {
      const creator = await get('SELECT * FROM users WHERE openid = ?', [openid])
      const fmt = (d) => {
        const date = new Date(d)
        return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
      }
      await sendSubscribeMessage(openid, 'NUejq84LuZ3CzlnoKnaDN-YczktShhR-71EWRCIs4F4', '/pages/index/index', {
        name1: { value: creator && creator.nick_name ? creator.nick_name : '家人' },
        thing3: { value: title.trim().slice(0, 20) },
        time13: { value: fmt(startTime) },
        time14: { value: fmt(endTime) }
      })
    } catch (err) {
      console.error('发送订阅消息失败', err.message)
    }
  }

  ctx.body = { code: 200, data: evt }
})

// PUT /api/events/:id
router.put('/:id', async (ctx) => {
  const { openid } = ctx.state.user
  const id = parseInt(ctx.params.id)
  const data = ctx.request.body

  const row = await get('SELECT * FROM events WHERE id = ?', [id])
  if (!row) {
    ctx.body = { code: 404, msg: '日程不存在' }
    return
  }

  const family = await getFamilyByMember(openid)
  if (!family || family.id !== row.family_id) {
    ctx.body = { code: 403, msg: '无权访问' }
    return
  }

  const members = family.members || []
  const member = members.find(m => m.openid === openid)
  const canEdit = row.creator_openid === openid || (member && (member.role === 'creator' || member.role === 'admin'))
  if (!canEdit) {
    ctx.body = { code: 403, msg: '无权编辑此日程' }
    return
  }

  // 审核模式：禁止改为 family 类型，忽略参与人
  if (isReviewMode()) {
    if (data.type === 'family') {
      ctx.body = { code: 403, msg: '暂不支持家庭类型日程' }
      return
    }
    if (data.participants !== undefined) {
      data.participants = []
    }
  }

  const allowed = ['title', 'type', 'participants', 'isAllDay', 'startTime', 'endTime', 'location', 'remark', 'isDone', 'visibility', 'reminderEnabled']
  const sets = []
  const vals = []

  for (const key of allowed) {
    if (data[key] !== undefined) {
      if (key === 'reminderEnabled') {
        sets.push('reminders = ?')
        vals.push(JSON.stringify({ enabled: !!data[key] }))
        continue
      }
      let dbKey = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
      if (dbKey === 'is_all_day' || dbKey === 'is_done') {
        sets.push(`${dbKey} = ?`)
        vals.push(data[key] ? 1 : 0)
      } else if (dbKey === 'participants') {
        sets.push(`${dbKey} = ?`)
        vals.push(JSON.stringify(data[key]))
      } else if (dbKey === 'start_time' || dbKey === 'end_time') {
        sets.push(`${dbKey} = ?`)
        vals.push(new Date(data[key]).toISOString())
      } else {
        sets.push(`${dbKey} = ?`)
        vals.push(data[key])
      }
    }
  }

  if (sets.length === 0) {
    ctx.body = { code: 400, msg: '无更新内容' }
    return
  }

  sets.push('updated_at = CURRENT_TIMESTAMP')
  vals.push(id)

  await run(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, vals)
  ctx.body = { code: 200, msg: '更新成功' }
})

// DELETE /api/events/:id
router.delete('/:id', async (ctx) => {
  const { openid } = ctx.state.user
  const id = parseInt(ctx.params.id)

  const row = await get('SELECT * FROM events WHERE id = ?', [id])
  if (!row) {
    ctx.body = { code: 404, msg: '日程不存在' }
    return
  }

  const family = await getFamilyByMember(openid)
  if (!family || family.id !== row.family_id) {
    ctx.body = { code: 403, msg: '无权访问' }
    return
  }

  const members = family.members || []
  const member = members.find(m => m.openid === openid)
  const canDelete = row.creator_openid === openid || (member && (member.role === 'creator' || member.role === 'admin'))
  if (!canDelete) {
    ctx.body = { code: 403, msg: '无权删除此日程' }
    return
  }

  await run('DELETE FROM events WHERE id = ?', [id])
  ctx.body = { code: 200, msg: '删除成功' }
})

module.exports = router

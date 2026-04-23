const Router = require('koa-router')
const { all, get, run } = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = new Router({ prefix: '/api/family' })
router.use(authMiddleware())

function generateInviteCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function getMemberColor(index) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
  return colors[index % colors.length]
}

function rowToFamily(row) {
  if (!row) return null
  return {
    ...row,
    _id: String(row.id),
    members: JSON.parse(row.members || '[]')
  }
}

// GET /api/family
router.get('/', async (ctx) => {
  const { openid } = ctx.state.user
  const rows = await all('SELECT * FROM families')
  let family = null
  for (const row of rows) {
    const members = JSON.parse(row.members || '[]')
    if (members.some(m => m.openid === openid)) {
      family = rowToFamily(row)
      break
    }
  }

  if (!family) {
    ctx.body = { code: 404, msg: '未加入任何家庭' }
    return
  }

  ctx.body = { code: 200, data: family }
})

// POST /api/family
router.post('/', async (ctx) => {
  const { openid } = ctx.state.user
  const { name, nickName, identityTag } = ctx.request.body

  if (!name || !nickName) {
    ctx.body = { code: 400, msg: '家庭名称和昵称不能为空' }
    return
  }

  // 检查是否已有家庭
  const allRows = await all('SELECT * FROM families')
  for (const row of allRows) {
    const members = JSON.parse(row.members || '[]')
    if (members.some(m => m.openid === openid)) {
      ctx.body = { code: 409, msg: '您已加入一个家庭，请先退出' }
      return
    }
  }

  const inviteCode = generateInviteCode()
  const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const members = JSON.stringify([{
    openid,
    nickName,
    identityTag: identityTag || '其他',
    color: getMemberColor(0),
    role: 'creator',
    joinedAt: new Date().toISOString()
  }])

  const result = await run(
    'INSERT INTO families (name, creator_openid, members, invite_code, invite_code_expire_at) VALUES (?, ?, ?, ?, ?)',
    [name, openid, members, inviteCode, expireAt]
  )

  const family = rowToFamily(await get('SELECT * FROM families WHERE id = ?', [result.lastID]))
  ctx.body = { code: 200, data: family }
})

// POST /api/family/join
router.post('/join', async (ctx) => {
  const { openid } = ctx.state.user
  const { inviteCode, nickName, identityTag } = ctx.request.body

  if (!inviteCode || !nickName) {
    ctx.body = { code: 400, msg: '邀请码和昵称不能为空' }
    return
  }

  const row = await get('SELECT * FROM families WHERE invite_code = ?', [inviteCode])
  if (!row) {
    ctx.body = { code: 404, msg: '邀请码无效' }
    return
  }

  const family = rowToFamily(row)

  if (new Date(family.invite_code_expire_at) < new Date()) {
    ctx.body = { code: 410, msg: '邀请码已过期' }
    return
  }

  if (family.members.some(m => m.openid === openid)) {
    ctx.body = { code: 409, msg: '您已在该家庭中' }
    return
  }

  // 检查是否在其他家庭
  const allRows = await all('SELECT * FROM families')
  for (const r of allRows) {
    const ms = JSON.parse(r.members || '[]')
    if (ms.some(m => m.openid === openid)) {
      ctx.body = { code: 409, msg: '您已加入其他家庭，请先退出' }
      return
    }
  }

  const newMember = {
    openid,
    nickName,
    identityTag: identityTag || '其他',
    color: getMemberColor(family.members.length),
    role: 'member',
    joinedAt: new Date().toISOString()
  }
  family.members.push(newMember)

  await run(
    'UPDATE families SET members = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(family.members), family.id]
  )

  ctx.body = { code: 200, data: family }
})

// POST /api/family/refresh-code
router.post('/refresh-code', async (ctx) => {
  const { openid } = ctx.state.user
  const { familyId } = ctx.request.body

  const row = await get('SELECT * FROM families WHERE id = ?', [familyId])
  if (!row) {
    ctx.body = { code: 404, msg: '家庭不存在' }
    return
  }

  if (row.creator_openid !== openid) {
    ctx.body = { code: 403, msg: '无权操作' }
    return
  }

  const inviteCode = generateInviteCode()
  const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await run(
    'UPDATE families SET invite_code = ?, invite_code_expire_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [inviteCode, expireAt, familyId]
  )

  ctx.body = { code: 200, data: { inviteCode, inviteCodeExpireAt: expireAt } }
})

// PUT /api/family/member
router.put('/member', async (ctx) => {
  const { openid } = ctx.state.user
  const { familyId, nickName, identityTag } = ctx.request.body

  const row = await get('SELECT * FROM families WHERE id = ?', [familyId])
  if (!row) {
    ctx.body = { code: 404, msg: '家庭不存在' }
    return
  }

  const members = JSON.parse(row.members || '[]')
  const idx = members.findIndex(m => m.openid === openid)
  if (idx === -1) {
    ctx.body = { code: 403, msg: '您不在该家庭中' }
    return
  }

  if (nickName !== undefined && nickName.trim() !== '') {
    members[idx].nickName = nickName.trim()
  }
  if (identityTag !== undefined) {
    members[idx].identityTag = identityTag.trim() || '其他'
  }

  await run(
    'UPDATE families SET members = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(members), familyId]
  )

  ctx.body = { code: 200, data: members[idx] }
})

// POST /api/family/leave
router.post('/leave', async (ctx) => {
  const { openid } = ctx.state.user
  const { familyId } = ctx.request.body

  const row = await get('SELECT * FROM families WHERE id = ?', [familyId])
  if (!row) {
    ctx.body = { code: 404, msg: '家庭不存在' }
    return
  }

  const members = JSON.parse(row.members || '[]')
  const idx = members.findIndex(m => m.openid === openid)
  if (idx === -1) {
    ctx.body = { code: 403, msg: '您不在该家庭中' }
    return
  }

  if (members[idx].role === 'creator') {
    ctx.body = { code: 403, msg: '创建者不能退出，请解散家庭' }
    return
  }

  members.splice(idx, 1)
  await run(
    'UPDATE families SET members = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(members), familyId]
  )

  ctx.body = { code: 200, msg: '已退出家庭' }
})

module.exports = router

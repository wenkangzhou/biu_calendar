const Router = require('koa-router')
const { all, get, run } = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = new Router({ prefix: '/api/users' })
router.use(authMiddleware())

// PUT /api/users 更新当前用户信息
router.put('/', async (ctx) => {
  const { openid } = ctx.state.user
  const { nickName, avatarUrl } = ctx.request.body

  const user = await get('SELECT * FROM users WHERE openid = ?', [openid])
  if (!user) {
    ctx.body = { code: 404, msg: '用户不存在' }
    return
  }

  const updates = []
  const vals = []

  if (nickName !== undefined) {
    updates.push('nick_name = ?')
    vals.push(nickName)
  }
  if (avatarUrl !== undefined) {
    updates.push('avatar_url = ?')
    vals.push(avatarUrl)
  }

  if (updates.length === 0) {
    ctx.body = { code: 400, msg: '无更新内容' }
    return
  }

  updates.push('updated_at = CURRENT_TIMESTAMP')
  vals.push(openid)

  await run(`UPDATE users SET ${updates.join(', ')} WHERE openid = ?`, vals)

  // 同步更新所有家庭中的成员昵称/头像
  const families = await all('SELECT * FROM families')
  for (const f of families) {
    const members = JSON.parse(f.members || '[]')
    const idx = members.findIndex(m => m.openid === openid)
    if (idx !== -1) {
      if (nickName !== undefined) members[idx].nickName = nickName
      if (avatarUrl !== undefined) members[idx].avatarUrl = avatarUrl
      await run(
        'UPDATE families SET members = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [JSON.stringify(members), f.id]
      )
    }
  }

  const updated = await get('SELECT * FROM users WHERE openid = ?', [openid])
  ctx.body = { code: 200, data: updated }
})

module.exports = router

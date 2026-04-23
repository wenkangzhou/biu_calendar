const Router = require('koa-router')
const { get, run } = require('../db')
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

  const updated = await get('SELECT * FROM users WHERE openid = ?', [openid])
  ctx.body = { code: 200, data: updated }
})

module.exports = router

const Router = require('koa-router')
const axios = require('axios')
const db = require('../db')
const { signToken } = require('../middleware/auth')

const router = new Router({ prefix: '/api/auth' })

const WX_APPID = process.env.WX_APPID
const WX_SECRET = process.env.WX_SECRET

// POST /api/auth/login
router.post('/login', async (ctx) => {
  const { code, nickName, avatarUrl } = ctx.request.body

  if (!code) {
    ctx.body = { code: 400, msg: '缺少 code 参数' }
    return
  }

  // 调用微信 auth.code2session
  const url = 'https://api.weixin.qq.com/sns/jscode2session'
  const params = {
    appid: WX_APPID,
    secret: WX_SECRET,
    js_code: code,
    grant_type: 'authorization_code'
  }

  let sessionRes
  try {
    sessionRes = await axios.get(url, { params, timeout: 10000 })
  } catch (err) {
    ctx.body = { code: 500, msg: '微信接口请求失败' }
    return
  }

  const { openid, unionid, errcode, errmsg } = sessionRes.data

  if (errcode) {
    ctx.body = { code: 500, msg: `微信接口错误: ${errmsg || errcode}` }
    return
  }

  if (!openid) {
    ctx.body = { code: 500, msg: '无法获取用户 openid' }
    return
  }

  // 查找或创建用户
  let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid)

  if (!user) {
    const result = db.prepare(
      'INSERT INTO users (openid, nick_name, avatar_url) VALUES (?, ?, ?)'
    ).run(openid, nickName || '', avatarUrl || '')
    user = {
      id: result.lastInsertRowid,
      openid,
      nick_name: nickName || '',
      avatar_url: avatarUrl || ''
    }
  } else if (nickName || avatarUrl) {
    db.prepare('UPDATE users SET nick_name = COALESCE(?, nick_name), avatar_url = COALESCE(?, avatar_url), updated_at = CURRENT_TIMESTAMP WHERE openid = ?')
      .run(nickName || null, avatarUrl || null, openid)
    user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid)
  }

  // 查找用户所在家庭
  const allFamilies = db.prepare('SELECT * FROM families').all()
  let family = null
  for (const f of allFamilies) {
    const members = JSON.parse(f.members || '[]')
    if (members.some(m => m.openid === openid)) {
      family = { ...f, members }
      break
    }
  }

  const token = signToken({ openid, userId: user.id })

  ctx.body = {
    code: 200,
    data: {
      openid,
      user,
      family,
      token
    }
  }
})

module.exports = router

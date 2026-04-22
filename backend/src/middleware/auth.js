const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_me'

function authMiddleware() {
  return async (ctx, next) => {
    const authHeader = ctx.headers.authorization || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')

    if (!token) {
      ctx.status = 401
      ctx.body = { code: 401, msg: '缺少登录凭证' }
      return
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      ctx.state.user = decoded
      await next()
    } catch (err) {
      ctx.status = 401
      ctx.body = { code: 401, msg: '登录凭证无效或已过期' }
    }
  }
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

module.exports = { authMiddleware, signToken }

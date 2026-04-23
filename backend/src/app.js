require('dotenv').config()

const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const cors = require('koa2-cors')

const authRouter = require('./routes/auth')
const familyRouter = require('./routes/family')
const eventRouter = require('./routes/event')
const userRouter = require('./routes/user')

const app = new Koa()
const PORT = process.env.PORT || 3000

// 日志
app.use(async (ctx, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  console.log(`${ctx.method} ${ctx.url} - ${ctx.status} - ${ms}ms`)
})

// CORS：允许小程序域名访问，生产环境建议限制为具体域名
app.use(cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

app.use(bodyParser())

// 健康检查
app.use(async (ctx, next) => {
  if (ctx.path === '/health') {
    ctx.body = { status: 'ok', time: new Date().toISOString() }
    return
  }
  await next()
})

// 路由
app.use(authRouter.routes()).use(authRouter.allowedMethods())
app.use(familyRouter.routes()).use(familyRouter.allowedMethods())
app.use(eventRouter.routes()).use(eventRouter.allowedMethods())
app.use(userRouter.routes()).use(userRouter.allowedMethods())

// 404
app.use(async (ctx) => {
  ctx.status = 404
  ctx.body = { code: 404, msg: '接口不存在' }
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📎 API Base: http://localhost:${PORT}/api`)
})

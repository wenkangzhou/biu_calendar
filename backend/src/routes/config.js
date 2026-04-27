const Router = require('koa-router')
const { isReviewMode } = require('../config')

const router = new Router({ prefix: '/api/config' })

// GET /api/config
router.get('/', async (ctx) => {
  ctx.body = {
    code: 200,
    data: {
      reviewMode: isReviewMode()
    }
  }
})

module.exports = router
